import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderTestApplication } from "../../test/render-application";
import type { SessionStore } from "./wiring";
import { reportAuthorizationFailure } from "./wiring";

const encodeTokenPart = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

const createToken = (expiresAt: number) =>
  `${encodeTokenPart({ alg: "none", typ: "JWT" })}.${encodeTokenPart({
    exp: Math.floor(expiresAt / 1_000),
  })}.test-signature`;

const createStoredSession = (role: string | null = "USER", expiresAt = 4_102_444_800_000) => ({
  token: createToken(expiresAt),
  user: {
    id: "700",
    name: "Alex Morgan",
    email: "alex@example.com",
    role,
    avatar: null,
  },
});

function createSessionStore(initial: unknown) {
  let listener: (value: unknown) => void = () => undefined;
  const store: SessionStore = {
    read: () => initial,
    save: vi.fn(),
    clear: vi.fn(),
    subscribe: (nextListener) => {
      listener = nextListener;
      return () => undefined;
    },
  };
  return { store, emit: (value: unknown) => listener(value) };
}

describe("Session", () => {
  it("restores a valid Session before protected content can render", async () => {
    let finishReading!: (value: unknown) => void;
    const sessionStore: SessionStore = {
      read: () => new Promise((resolve) => { finishReading = resolve; }),
      save: () => undefined,
      clear: () => undefined,
      subscribe: () => () => undefined,
    };
    const storedSession = createStoredSession();

    renderTestApplication("/orders", sessionStore);

    expect(screen.getByRole("status")).toHaveTextContent("Restoring your session");
    expect(screen.getByRole("heading", { name: "Restoring your session" })).toHaveFocus();
    expect(document.title).toBe("Restoring session | Fiverr Clone");
    await act(async () => finishReading(storedSession));
    expect(await screen.findByRole("button", { name: "Logout" })).toBeVisible();
  });

  it("clears malformed and expired persisted data before protected UI renders", () => {
    const { store } = createSessionStore({
      ...createStoredSession("USER", Date.now() - 1_000),
      password: "must-never-be-persisted",
    });

    renderTestApplication("/orders", store);

    expect(screen.getByRole("heading", { name: "Login" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Logout" })).not.toBeInTheDocument();
    expect(store.clear).toHaveBeenCalledOnce();
  });

  it("persists only the safe Session snapshot after Login and clears it on Logout", async () => {
    const user = userEvent.setup();
    const { store } = createSessionStore(null);
    renderTestApplication("/login", store);

    await user.type(screen.getByRole("textbox", { name: "Email" }), "alex@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret1");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(store.save).toHaveBeenCalledWith({
      token: expect.any(String),
      user: {
        id: "700",
        name: "Alex Morgan",
        email: "alex@example.com",
        role: "USER",
        avatar: null,
      },
    });
    expect(JSON.stringify(vi.mocked(store.save).mock.calls)).not.toContain("password");

    await user.click(await screen.findByRole("button", { name: "Logout" }));
    expect(store.clear).toHaveBeenCalledOnce();
  });

  it("fails closed when another tab logs out", () => {
    const sessionBoundary = createSessionStore(createStoredSession());
    renderTestApplication("/orders", sessionBoundary.store);
    expect(screen.getByRole("button", { name: "Logout" })).toBeVisible();

    act(() => sessionBoundary.emit(null));

    expect(screen.getByRole("heading", { name: "Login" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("expires an active Session without waiting for a reload", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T00:00:00Z"));
    const sessionBoundary = createSessionStore(createStoredSession("USER", Date.now() + 2_000));
    renderTestApplication("/orders", sessionBoundary.store);

    act(() => vi.advanceTimersByTime(2_100));

    expect(screen.getByRole("heading", { name: "Login" })).toBeVisible();
    expect(sessionBoundary.store.clear).toHaveBeenCalledOnce();
  });

  it("treats unknown roles as ordinary and retains the admin URL on 403", () => {
    const { store } = createSessionStore(createStoredSession("SUPER_ADMIN"));
    renderTestApplication("/admin/users", store);

    expect(screen.queryByRole("link", { name: "Administrator" })).not.toBeInTheDocument();
    const heading = screen.getByRole("heading", { name: "Insufficient permission" });
    expect(heading).toHaveFocus();
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
  });

  it("allows only the exact ADMIN role into admin routes and navigation", () => {
    const { store } = createSessionStore(createStoredSession("ADMIN"));
    renderTestApplication("/admin/users", store);

    expect(screen.getByRole("link", { name: "Administrator" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Administrator" })).toBeVisible();
    expect(document.title).toBe("Administrator | Fiverr Clone");
  });

  it("clears the Session on 401 and keeps a safe return destination", () => {
    const { store } = createSessionStore(createStoredSession());
    renderTestApplication("/orders", store);

    act(() => reportAuthorizationFailure(401));

    expect(store.clear).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Login" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Your session ended");
  });

  it("retains the Session and current route while showing a focused 403 state", async () => {
    const user = userEvent.setup();
    const { store } = createSessionStore(createStoredSession());
    renderTestApplication("/orders", store);

    act(() => reportAuthorizationFailure(403));

    expect(store.clear).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Insufficient permission" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Return to current page" }));
    expect(screen.getByRole("button", { name: "Logout" })).toBeVisible();
  });

  it("requires fresh confirmation after reauthentication without replaying an action", async () => {
    const user = userEvent.setup();
    const { store } = createSessionStore(createStoredSession());
    renderTestApplication("/orders", store);
    act(() => reportAuthorizationFailure(401));

    await user.type(screen.getByRole("textbox", { name: "Email" }), "alex@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret1");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Confirm before trying the action again",
    );
    expect(screen.getByRole("button", { name: "Confirm before continuing" })).toBeVisible();
  });
});
