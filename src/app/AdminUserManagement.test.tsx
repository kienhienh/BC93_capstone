import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { SessionStore } from "../features/authentication/wiring";
import { renderTestApplication } from "../test/render-application";
import { server } from "../test/server";

const apiBaseUrl = "http://api.example.test/api";
const usersListUrl = `${apiBaseUrl}/users/phan-trang-tim-kiem`;
const usersUrl = `${apiBaseUrl}/users`;
const userUrl = (id: string) => `${usersUrl}/${id}`;

const users = [
  { id: 1, name: "John Doe", email: "john@example.com", phone: "0123456789", birthday: "1990-01-01", avatar: null, gender: true, role: "USER", skill: ["React"], certification: [] },
  { id: 2, name: "Jane Admin", email: "admin@example.com", phone: "0987654321", birthday: "1992-01-01", avatar: null, gender: false, role: "ADMIN", skill: ["TypeScript"], certification: ["WCAG"] },
];

function listResponse(data = users, totalRow = 25) {
  return { content: { pageIndex: 1, pageSize: 10, totalRow, keywords: null, data } };
}

const encodeTokenPart = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

function sessionStoreWithRole(role: unknown, includeRole = true): SessionStore {
  const user: Record<string, unknown> = {
    id: "901",
    name: "Role Test",
    email: "role@example.com",
    avatar: null,
  };
  if (includeRole) user.role = role;
  return {
    read: () => ({
      token: `${encodeTokenPart({ alg: "none", typ: "JWT" })}.${encodeTokenPart({ exp: 4_102_444_800 })}.signature`,
      user,
    }),
    save: () => undefined,
    clear: () => undefined,
    subscribe: () => () => undefined,
  };
}

describe("Admin User Management", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    server.use(
      http.get(usersListUrl, () => HttpResponse.json(listResponse())),
      http.get(userUrl("1"), () => HttpResponse.json({ content: [users[0]] })),
      http.get(userUrl("2"), () => HttpResponse.json({ content: [users[1]] })),
    );
  });

  it("shows the local Administrator dashboard with all six management destinations", async () => {
    renderTestApplication({ initialPath: "/admin", isAdmin: true });

    const heading = await screen.findByRole(
      "heading",
      { name: "Administrator Dashboard" },
      { timeout: 5_000 },
    );
    expect(heading).toHaveFocus();
    expect(document.title).toBe("Administrator | Fiverr Clone");

    const desktopNavigation = screen.getByRole("complementary", { name: "Administrator navigation" });
    expect(within(desktopNavigation).getByRole("link", { name: "Users" })).toHaveAttribute("href", "/admin/users");
    for (const label of ["Services", "Service Categories", "Service Subcategories", "Comments", "Hired Services"]) {
      expect(within(desktopNavigation).getByText(label)).toBeVisible();
    }

    const mobileNavigation = screen.getByRole("navigation", { name: "Administrator mobile navigation" });
    for (const label of ["Users", "Services", "Service Categories", "Service Subcategories", "Comments", "Hired Services"]) {
      expect(within(mobileNavigation).getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText(/total users|revenue|analytics/i)).not.toBeInTheDocument();
  });

  it("fails closed for ordinary, unknown-role, missing-role, and Visitor identities", async () => {
    const ordinary = renderTestApplication({ initialPath: "/admin", isAdmin: false });
    expect(await screen.findByRole("heading", { name: "Insufficient permission" })).toHaveFocus();
    expect(screen.queryByRole("complementary", { name: "Administrator navigation" })).not.toBeInTheDocument();
    ordinary.unmount();

    const unknown = renderTestApplication({
      initialPath: "/admin",
      sessionStore: sessionStoreWithRole("SUPERADMIN"),
    });
    expect(await screen.findByRole("heading", { name: "Insufficient permission" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Administrator" })).not.toBeInTheDocument();
    unknown.unmount();

    const missing = renderTestApplication({
      initialPath: "/admin",
      sessionStore: sessionStoreWithRole(undefined, false),
    });
    expect(await screen.findByRole("heading", { name: "Login" })).toBeVisible();
    expect(missing.currentLocation()).toBe("/login?returnTo=%2Fadmin");
    missing.unmount();

    const visitor = renderTestApplication({ initialPath: "/admin/users", isAuthenticated: false });
    expect(await screen.findByRole("heading", { name: "Login" })).toBeVisible();
    expect(visitor.currentLocation()).toBe("/login?returnTo=%2Fadmin%2Fusers");
    expect(screen.queryByText("Preparing Administrator workspace...")).not.toBeInTheDocument();
  });

  it("renders roles, labelled responsive cells, and exactly the supported page sizes", async () => {
    const application = renderTestApplication({ initialPath: "/admin/users", isAdmin: true });
    const user = userEvent.setup();
    const heading = await screen.findByRole("heading", { name: "User Management" });
    expect(heading).toHaveFocus();
    expect(document.title).toBe("User Management | Administrator");

    const table = await screen.findByRole("grid", { name: "User list" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText("USER")).toBeVisible();
    expect(within(rows[2]).getByText("ADMIN")).toBeVisible();
    expect(within(rows[1]).getByText("john@example.com").closest("td")).toHaveAttribute("data-label", "Email");
    expect(within(rows[1]).getByRole("link", { name: "View" })).toBeVisible();

    const pageSize = screen.getByRole("combobox", { name: "Page size" });
    expect(within(pageSize).getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual(["10", "25", "50"]);
    await user.selectOptions(pageSize, "25");
    expect(pageSize).toHaveDisplayValue("25 per page");
    expect(application.currentLocation()).toBe("/admin/users?page=1&pageSize=25");
  });

  it("normalizes and stores q, page and pageSize in the URL and sends the search keyword", async () => {
    let keyword: string | null = null;
    server.use(http.get(usersListUrl, ({ request }) => {
      keyword = new URL(request.url).searchParams.get("keyword");
      return HttpResponse.json(listResponse(keyword ? [users[0]] : users, keyword ? 1 : 25));
    }));
    const application = renderTestApplication({ initialPath: "/admin/users?page=0&pageSize=999", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("grid", { name: "User list" });
    expect(application.currentLocation()).toBe("/admin/users?page=1&pageSize=10");

    await user.type(screen.getByRole("searchbox", { name: "Search users by name or email" }), "john");
    await waitFor(() => expect(keyword).toBe("john"));
    expect(application.currentLocation()).toBe("/admin/users?q=john&page=1&pageSize=10");
  });

  it("distinguishes initial loading, refreshing, empty, and query-empty states", async () => {
    let requestCount = 0;
    server.use(http.get(usersListUrl, async ({ request }) => {
      requestCount += 1;
      if (requestCount === 1) await delay(40);
      if (requestCount === 2) await delay(80);
      const keyword = new URL(request.url).searchParams.get("keyword");
      return HttpResponse.json(keyword ? listResponse([], 0) : listResponse());
    }));
    const user = userEvent.setup();
    const application = renderTestApplication({ initialPath: "/admin/users", isAdmin: true });

    expect(await screen.findByText("Loading users...")).toHaveAttribute("data-state", "loading");
    await screen.findByRole("grid", { name: "User list" });
    await user.click(screen.getByRole("button", { name: "Refresh users" }));
    expect(await screen.findByText("Refreshing users...")).toHaveAttribute("data-state", "refreshing");
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh users" })).toBeEnabled());

    await user.type(screen.getByRole("searchbox", { name: "Search users by name or email" }), "missing");
    expect(await screen.findByText(/No users match your search/)).toHaveAttribute("data-state", "query-empty");
    application.unmount();

    server.use(http.get(usersListUrl, () => HttpResponse.json(listResponse([], 0))));
    const empty = renderTestApplication({ initialPath: "/admin/users", isAdmin: true });
    expect(await screen.findByText("No users found.")).toHaveAttribute("data-state", "empty");
    empty.unmount();
  });

  it("distinguishes malformed, offline, forbidden, not-found, and recoverable server failures", async () => {
    server.use(http.get(usersListUrl, () => HttpResponse.json({ content: "bad-shape" })));
    const malformed = renderTestApplication({ initialPath: "/admin/users", isAdmin: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid response");
    expect(screen.getByRole("alert")).toHaveAttribute("data-state", "malformed");
    malformed.unmount();

    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    server.use(http.get(usersListUrl, () => HttpResponse.error()));
    const offline = renderTestApplication({ initialPath: "/admin/users", isAdmin: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("You are offline");
    expect(screen.getByRole("alert")).toHaveAttribute("data-state", "offline");
    offline.unmount();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });

    server.use(http.get(usersListUrl, () => HttpResponse.json({ message: "Forbidden" }, { status: 403 })));
    const forbidden = renderTestApplication({ initialPath: "/admin/users", isAdmin: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("Access forbidden");
    expect(screen.getByRole("alert")).toHaveAttribute("data-state", "forbidden");
    forbidden.unmount();

    server.use(http.get(userUrl("999"), () => HttpResponse.json({ message: "Not found" }, { status: 404 })));
    const missing = renderTestApplication({ initialPath: "/admin/users/999", isAdmin: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("User not found");
    expect(screen.getByRole("alert")).toHaveAttribute("data-state", "not_found");
    missing.unmount();

    let attempts = 0;
    server.use(http.get(usersListUrl, () => {
      attempts += 1;
      return attempts === 1
        ? HttpResponse.json({ message: "Unavailable" }, { status: 503 })
        : HttpResponse.json(listResponse());
    }));
    renderTestApplication({ initialPath: "/admin/users", isAdmin: true });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Server error");
    await userEvent.setup().click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("grid", { name: "User list" })).toBeVisible();
  });

  it("validates Create locally, focuses the first invalid field, and exposes only USER/ADMIN roles", async () => {
    renderTestApplication({ initialPath: "/admin/users/new", isAdmin: true });
    const user = userEvent.setup();
    const heading = await screen.findByRole("heading", { name: "Create User" });
    expect(heading).toHaveFocus();
    expect(document.title).toBe("Create User | Administrator");

    const role = screen.getByRole("combobox", { name: /Role/ });
    expect(within(role).getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual(["USER", "ADMIN"]);
    await user.click(screen.getByRole("button", { name: "Create User" }));
    expect(await screen.findByText("Name is required.")).toBeVisible();
    await waitFor(() => expect(screen.getByRole("textbox", { name: /Full Name/ })).toHaveFocus());
  });

  it("shows pending then confirmed Create success and never sends a password", async () => {
    let requestBody: Record<string, unknown> | undefined;
    server.use(http.post(usersUrl, async ({ request }) => {
      requestBody = await request.json() as Record<string, unknown>;
      await delay(60);
      return HttpResponse.json({ content: { ...users[0], id: 100, name: requestBody.name, email: requestBody.email, role: requestBody.role } });
    }));
    const application = renderTestApplication({ initialPath: "/admin/users/new", isAdmin: true });
    const user = userEvent.setup();
    await user.type(await screen.findByRole("textbox", { name: /Full Name/ }), "New User");
    await user.type(screen.getByRole("textbox", { name: /Email/ }), "new@example.com");
    await user.selectOptions(screen.getByRole("combobox", { name: /Role/ }), "ADMIN");
    await user.click(screen.getByRole("button", { name: "Create User" }));

    expect(await screen.findByText("Creating user...")).toHaveAttribute("data-state", "pending");
    await waitFor(() => expect(requestBody).toBeDefined());
    expect(requestBody).toMatchObject({ name: "New User", email: "new@example.com", role: "ADMIN", skill: [], certification: [] });
    expect(requestBody).not.toHaveProperty("password");
    await waitFor(() => expect(application.currentLocation()).toBe("/admin/users"));
    expect(screen.getByText("User New User created successfully.")).toHaveAttribute("data-state", "confirmed-success");
  });

  it("keeps Create mutation failures local and preserves non-secret form work", async () => {
    server.use(http.post(usersUrl, () => HttpResponse.json({ message: "Unavailable" }, { status: 503 })));
    const application = renderTestApplication({ initialPath: "/admin/users/new", isAdmin: true });
    const user = userEvent.setup();

    const name = await screen.findByRole("textbox", { name: /Full Name/ });
    const email = screen.getByRole("textbox", { name: /Email/ });
    await user.type(name, "Retry User");
    await user.type(email, "retry@example.com");
    await user.click(screen.getByRole("button", { name: "Create User" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Server error");
    expect(alert).toHaveAttribute("data-state", "server");
    expect(application.currentLocation()).toBe("/admin/users/new");
    expect(name).toHaveValue("Retry User");
    expect(email).toHaveValue("retry@example.com");
  });

  it("loads User Detail with contextual title/h1 focus and accessible actions", async () => {
    renderTestApplication({ initialPath: "/admin/users/1", isAdmin: true });
    const heading = await screen.findByRole("heading", { name: "User Detail" });
    expect(heading).toHaveFocus();
    expect(document.title).toBe("User Detail | Administrator");
    expect(await screen.findByText("john@example.com")).toBeVisible();
    const actions = screen.getByRole("navigation", { name: "User detail actions" });
    expect(within(actions).getByRole("link", { name: "Back to list" })).toBeVisible();
    expect(within(actions).getByRole("link", { name: "Edit User" })).toBeVisible();
  });

  it("keeps the existing extra edit/delete tracer behavior working without passwords", async () => {
    let updateBody: Record<string, unknown> | undefined;
    let deletedId: string | null = null;
    server.use(
      http.put(userUrl("1"), async ({ request }) => {
        updateBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ content: { ...users[0], ...updateBody } });
      }),
      http.delete(usersUrl, ({ request }) => {
        deletedId = new URL(request.url).searchParams.get("id");
        return HttpResponse.json({ message: "Deleted successfully" });
      }),
    );

    const edit = renderTestApplication({ initialPath: "/admin/users/1/edit", isAdmin: true });
    const user = userEvent.setup();
    const name = await screen.findByRole("textbox", { name: /Full Name/ });
    await user.clear(name);
    await user.type(name, "John Updated");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(updateBody).toBeDefined());
    expect(updateBody).not.toHaveProperty("password");
    edit.unmount();

    renderTestApplication({ initialPath: "/admin/users", isAdmin: true });
    await screen.findByRole("grid", { name: "User list" });
    await user.click(screen.getByRole("button", { name: "Delete John Doe" }));
    expect(screen.getByRole("dialog", { name: "Delete user?" })).toBeVisible();
    expect(deletedId).toBeNull();
    await user.click(screen.getByRole("button", { name: "Confirm Delete" }));
    await waitFor(() => expect(deletedId).toBe("1"));
  });
});
