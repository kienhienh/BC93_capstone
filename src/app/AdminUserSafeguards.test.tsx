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

const john = { id: 1, name: "John Doe", email: "john@example.com", phone: "0123456789", birthday: "1990-01-01", avatar: null, gender: true, role: "USER", skill: ["React"], certification: [] };
const janeAdmin = { id: 2, name: "Jane Admin", email: "jane@example.com", phone: "0987654321", birthday: "1992-01-01", avatar: null, gender: false, role: "ADMIN", skill: ["TypeScript"], certification: ["WCAG"] };
const backupAdmin = { id: 3, name: "Backup Admin", email: "backup@example.com", phone: "", birthday: "", avatar: null, gender: true, role: "ADMIN", skill: [], certification: [] };
const legacy = { id: 4, name: "Legacy User", email: "legacy@example.com", phone: "", birthday: "", avatar: null, gender: true, role: "admin", skill: [], certification: [] };
const selfAdmin = { id: 900, name: "Self Admin", email: "self@example.com", phone: "", birthday: "", avatar: null, gender: true, role: "ADMIN", skill: [], certification: [] };

const encodeTokenPart = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

function adminSession(id = "900", email = "operator@example.com"): SessionStore {
  return {
    read: () => ({
      token: `${encodeTokenPart({ alg: "none", typ: "JWT" })}.${encodeTokenPart({ exp: 4_102_444_800 })}.signature`,
      user: { id, name: "Administrator", email, role: "ADMIN", avatar: null },
    }),
    save: () => undefined,
    clear: () => undefined,
    subscribe: () => () => undefined,
  };
}

function listResponse(data = [john, janeAdmin, backupAdmin], totalRow = 60, pageIndex = 1, pageSize = 10) {
  return { content: { pageIndex, pageSize, totalRow, keywords: null, data } };
}

function installDefaultHandlers() {
  server.use(
    http.get(usersListUrl, ({ request }) => {
      const url = new URL(request.url);
      return HttpResponse.json(listResponse(
        [john, janeAdmin, backupAdmin],
        60,
        Number(url.searchParams.get("pageIndex") ?? 1),
        Number(url.searchParams.get("pageSize") ?? 10),
      ));
    }),
    http.get(usersUrl, () => HttpResponse.json({ content: [john, janeAdmin, backupAdmin] })),
    http.get(userUrl("1"), () => HttpResponse.json({ content: [john] })),
    http.get(userUrl("2"), () => HttpResponse.json({ content: [janeAdmin] })),
    http.get(userUrl("3"), () => HttpResponse.json({ content: [backupAdmin] })),
    http.get(userUrl("4"), () => HttpResponse.json({ content: [legacy] })),
    http.get(userUrl("900"), () => HttpResponse.json({ content: [selfAdmin] })),
  );
}

async function findHeading(name: string) {
  return screen.findByRole("heading", { name }, { timeout: 5_000 });
}

async function fillTypedConfirmation(email: string, actionName: RegExp | string) {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: `Type ${email} to confirm` }), email);
  await user.click(screen.getByRole("button", { name: actionName }));
}

describe("Administrator User safeguards", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    installDefaultHandlers();
  });

  it("preserves q/page/pageSize across list, detail, edit and delete entry points with unique action names", async () => {
    const query = "?q=john&page=2&pageSize=25";
    const list = renderTestApplication({ initialPath: `/admin/users${query}`, sessionStore: adminSession() });
    await screen.findByRole("grid", { name: "User list" }, { timeout: 5_000 });
    expect(list.currentLocation()).toBe(`/admin/users${query}`);
    expect(screen.getByRole("link", { name: "View John Doe" })).toHaveAttribute("href", `/admin/users/1${query}`);
    expect(screen.getByRole("link", { name: "Edit John Doe" })).toHaveAttribute("href", `/admin/users/1/edit${query}`);
    expect(screen.getByRole("button", { name: "Delete John Doe" })).toBeVisible();
    list.unmount();

    const detail = renderTestApplication({ initialPath: `/admin/users/1${query}`, sessionStore: adminSession() });
    await findHeading("User Detail");
    expect(await screen.findByRole("link", { name: "Back to list" })).toHaveAttribute("href", `/admin/users${query}`);
    expect(screen.getByRole("link", { name: "Edit User" })).toHaveAttribute("href", `/admin/users/1/edit${query}`);
    expect(screen.getByRole("button", { name: "Delete John Doe" })).toBeVisible();
    detail.unmount();

    renderTestApplication({ initialPath: `/admin/users/1/edit${query}`, sessionStore: adminSession() });
    await findHeading("Edit User");
    expect(await screen.findByRole("link", { name: "Cancel" })).toHaveAttribute("href", `/admin/users${query}`);
    expect(await screen.findByRole("button", { name: "Delete John Doe" })).toBeVisible();
  });

  it("blocks self-delete, self-email changes and self-demotion before any mutation", async () => {
    let puts = 0;
    let deletes = 0;
    server.use(
      http.put(userUrl("900"), () => { puts += 1; return HttpResponse.json({ content: selfAdmin }); }),
      http.delete(usersUrl, () => { deletes += 1; return HttpResponse.json({ message: "Deleted" }); }),
    );
    const sessionStore = adminSession("900", "self@example.com");
    const user = userEvent.setup();

    const emailEdit = renderTestApplication({ initialPath: "/admin/users/900/edit", sessionStore });
    const email = await screen.findByRole("textbox", { name: /Email/ });
    await user.clear(email);
    await user.type(email, "changed@example.com");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("cannot change the email of your own Administrator identity");
    expect(screen.getByRole("alert")).toHaveAttribute("data-state", "validation-failure");
    expect(puts).toBe(0);
    emailEdit.unmount();

    const roleEdit = renderTestApplication({ initialPath: "/admin/users/900/edit", sessionStore });
    await screen.findByRole("combobox", { name: /Role/ });
    await user.selectOptions(screen.getByRole("combobox", { name: /Role/ }), "USER");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("cannot demote your own Administrator identity");
    expect(puts).toBe(0);
    roleEdit.unmount();

    renderTestApplication({ initialPath: "/admin/users/900", sessionStore });
    await screen.findByText("self@example.com");
    await user.click(screen.getByRole("button", { name: "Delete Self Admin" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("cannot delete your own Administrator identity");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deletes).toBe(0);
  });

  it("displays legacy roles exactly and never silently normalizes them during an unrelated update", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.get(usersListUrl, () => HttpResponse.json(listResponse([legacy], 1))),
      http.put(userUrl("4"), async ({ request }) => {
        body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ content: { ...legacy, name: body.name } });
      }),
    );
    const user = userEvent.setup();
    const list = renderTestApplication({ initialPath: "/admin/users", sessionStore: adminSession() });
    const table = await screen.findByRole("grid", { name: "User list" });
    expect(within(table).getByText("admin")).toBeVisible();
    expect(within(table).getByText("Unsupported legacy role")).toBeInTheDocument();
    list.unmount();

    const edit = renderTestApplication({ initialPath: "/admin/users/4/edit", sessionStore: adminSession() });
    await findHeading("Edit User");
    expect(await screen.findByText(/Legacy role “admin” is unsupported/)).toBeVisible();
    const role = screen.getByRole("combobox", { name: /Role/ });
    expect(within(role).getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual(["", "USER", "ADMIN"]);
    expect(role).toHaveDisplayValue("Legacy role: admin (unchanged)");
    const name = screen.getByRole("textbox", { name: /Full Name/ });
    await user.clear(name);
    await user.type(name, "Legacy Renamed");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(body).toBeDefined());
    expect(body).not.toHaveProperty("role");
    expect(body).not.toHaveProperty("password");
    await waitFor(() => expect(edit.currentLocation()).toBe("/admin/users/4"));
  });

  it("allows Administrator demotion only after proving another exact ADMIN remains", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.get(usersUrl, () => HttpResponse.json({ content: [janeAdmin, backupAdmin] })),
      http.put(userUrl("2"), async ({ request }) => {
        body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ content: { ...janeAdmin, role: "USER" } });
      }),
    );
    const application = renderTestApplication({ initialPath: "/admin/users/2/edit", sessionStore: adminSession() });
    const user = userEvent.setup();
    await screen.findByRole("combobox", { name: /Role/ });
    await user.selectOptions(screen.getByRole("combobox", { name: /Role/ }), "USER");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    const dialog = screen.getByRole("dialog", { name: "Confirm sensitive changes for Jane Admin" });
    expect(within(dialog).getByRole("button", { name: /Cancel confirm changes/ })).toHaveFocus();
    await fillTypedConfirmation("jane@example.com", "Confirm Changes for Jane Admin");
    await waitFor(() => expect(body).toBeDefined());
    expect(body).toHaveProperty("role", "USER");
    await waitFor(() => expect(application.currentLocation()).toBe("/admin/users/2"));
  });

  it("blocks last-Administrator demotion and also blocks when dependency proof cannot be obtained", async () => {
    let puts = 0;
    server.use(
      http.get(usersUrl, () => HttpResponse.json({ content: [janeAdmin] })),
      http.put(userUrl("2"), () => { puts += 1; return HttpResponse.json({ content: { ...janeAdmin, role: "USER" } }); }),
    );
    const user = userEvent.setup();
    const lastAdmin = renderTestApplication({ initialPath: "/admin/users/2/edit", sessionStore: adminSession() });
    await screen.findByRole("combobox", { name: /Role/ });
    await user.selectOptions(screen.getByRole("combobox", { name: /Role/ }), "USER");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await fillTypedConfirmation("jane@example.com", "Confirm Changes for Jane Admin");
    expect(await screen.findByRole("alert")).toHaveTextContent("another Administrator cannot be proven to remain");
    expect(screen.getByRole("alert")).toHaveAttribute("data-state", "blocked-dependency");
    expect(puts).toBe(0);
    lastAdmin.unmount();

    server.use(http.get(usersUrl, () => HttpResponse.json({ message: "Unavailable" }, { status: 503 })));
    renderTestApplication({ initialPath: "/admin/users/2/edit", sessionStore: adminSession() });
    await screen.findByRole("combobox", { name: /Role/ });
    await user.selectOptions(screen.getByRole("combobox", { name: /Role/ }), "USER");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await fillTypedConfirmation("jane@example.com", "Confirm Changes for Jane Admin");
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not prove that another Administrator remains");
    expect(puts).toBe(0);
  });

  it("blocks Administrator deletion when another exact ADMIN cannot be proven to remain", async () => {
    let deletes = 0;
    server.use(
      http.get(usersUrl, () => HttpResponse.json({ content: [janeAdmin] })),
      http.delete(usersUrl, () => { deletes += 1; return HttpResponse.json({ message: "Deleted" }); }),
    );
    renderTestApplication({ initialPath: "/admin/users/2", sessionStore: adminSession() });
    const user = userEvent.setup();
    await screen.findByText("jane@example.com");
    await user.click(screen.getByRole("button", { name: "Delete Jane Admin" }));
    await fillTypedConfirmation("jane@example.com", "Confirm Delete for Jane Admin");
    const blocked = await screen.findByRole("alert");
    expect(blocked).toHaveAttribute("data-state", "blocked-dependency");
    expect(blocked).toHaveTextContent("another Administrator cannot be proven to remain");
    expect(deletes).toBe(0);
  });

  it("requires exact typed email, focuses Cancel first, traps focus, and restores the destructive trigger", async () => {
    renderTestApplication({ initialPath: "/admin/users/1", sessionStore: adminSession() });
    const user = userEvent.setup();
    await screen.findByText("john@example.com");
    const trigger = screen.getByRole("button", { name: "Delete John Doe" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Delete John Doe?" });
    const cancel = within(dialog).getByRole("button", { name: /Cancel confirm delete/ });
    const confirm = within(dialog).getByRole("button", { name: "Confirm Delete for John Doe" });
    const email = within(dialog).getByRole("textbox", { name: "Type john@example.com to confirm" });
    expect(cancel).toHaveFocus();
    expect(confirm).toBeDisabled();
    await user.type(email, "john@example.co");
    expect(confirm).toBeDisabled();
    await user.type(email, "m");
    expect(confirm).toBeEnabled();

    confirm.focus();
    await user.tab();
    expect(email).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await user.click(cancel);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("refetches target evidence and blocks stale update/delete with Reload latest and no force path", async () => {
    const changed = { ...john, name: "Server Changed" };
    let reads = 0;
    let puts = 0;
    server.use(
      http.get(userUrl("1"), () => {
        reads += 1;
        return HttpResponse.json({ content: [reads === 1 ? john : changed] });
      }),
      http.put(userUrl("1"), () => { puts += 1; return HttpResponse.json({ content: changed }); }),
    );
    const user = userEvent.setup();
    const edit = renderTestApplication({ initialPath: "/admin/users/1/edit", sessionStore: adminSession() });
    const name = await screen.findByRole("textbox", { name: /Full Name/ });
    await user.clear(name);
    await user.type(name, "Local Change");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    const stale = await screen.findByRole("alert");
    expect(stale).toHaveAttribute("data-state", "stale");
    expect(stale).toHaveTextContent("changed after you opened the form");
    expect(within(stale).getByRole("button", { name: "Reload latest" })).toBeVisible();
    expect(screen.queryByText(/force overwrite/i)).not.toBeInTheDocument();
    expect(puts).toBe(0);
    await user.click(within(stale).getByRole("button", { name: "Reload latest" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: /Full Name/ })).toHaveValue("Server Changed"));
    edit.unmount();

    reads = 0;
    let deletes = 0;
    server.use(
      http.get(userUrl("1"), () => {
        reads += 1;
        return HttpResponse.json({ content: [reads === 1 ? john : changed] });
      }),
      http.delete(usersUrl, () => { deletes += 1; return HttpResponse.json({ message: "Deleted" }); }),
    );
    renderTestApplication({ initialPath: "/admin/users/1", sessionStore: adminSession() });
    await screen.findByText("john@example.com");
    await user.click(screen.getByRole("button", { name: "Delete John Doe" }));
    await fillTypedConfirmation("john@example.com", "Confirm Delete for John Doe");
    const deleteStale = await screen.findByRole("alert");
    expect(deleteStale).toHaveAttribute("data-state", "stale");
    expect(within(deleteStale).getByRole("button", { name: "Reload latest" })).toBeVisible();
    expect(screen.getByText(/There is no cascade or force-delete path/)).toBeVisible();
    expect(deletes).toBe(0);
  });

  it("warns before navigating away with unsaved non-secret work and keeps the safer Stay action focused", async () => {
    const application = renderTestApplication({ initialPath: "/admin/users/1/edit?q=john&page=2&pageSize=25", sessionStore: adminSession() });
    const user = userEvent.setup();
    const name = await screen.findByRole("textbox", { name: /Full Name/ });
    await user.type(name, " changed");
    await user.click(screen.getByRole("link", { name: "Cancel" }));

    const dialog = screen.getByRole("dialog", { name: "Leave with unsaved changes?" });
    expect(within(dialog).getByRole("button", { name: "Stay and keep editing" })).toHaveFocus();
    expect(application.currentLocation()).toBe("/admin/users/1/edit?q=john&page=2&pageSize=25");
    expect(screen.queryByRole("textbox", { name: /password|secret/i })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Stay and keep editing" }));
    expect(screen.queryByRole("dialog", { name: "Leave with unsaved changes?" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Leave without saving" }));
    await waitFor(() => expect(application.currentLocation()).toBe("/admin/users?q=john&page=2&pageSize=25"));
  });

  it("announces pending and confirmed success and distinguishes 401, 403 and offline mutation failures", async () => {
    const user = userEvent.setup();
    server.use(http.put(userUrl("1"), async ({ request }) => {
      const body = await request.json() as Record<string, unknown>;
      await delay(80);
      return HttpResponse.json({ content: { ...john, name: body.name } });
    }));
    const success = renderTestApplication({ initialPath: "/admin/users/1/edit", sessionStore: adminSession() });
    const name = await screen.findByRole("textbox", { name: /Full Name/ });
    await user.clear(name);
    await user.type(name, "Pending User");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByText("Checking latest evidence and updating user...")).toHaveAttribute("data-state", "pending");
    await waitFor(() => expect(success.currentLocation()).toBe("/admin/users/1"));
    expect(await screen.findByText(/updated successfully/)).toHaveAttribute("data-state", "confirmed-success");
    success.unmount();

    for (const [status, message, state] of [[401, "not authorized", "unauthorized"], [403, "Access forbidden", "forbidden"]] as const) {
      server.use(http.put(userUrl("1"), () => HttpResponse.json({ message }, { status })));
      const failed = renderTestApplication({ initialPath: "/admin/users/1/edit", sessionStore: adminSession() });
      const field = await screen.findByRole("textbox", { name: /Full Name/ });
      await user.clear(field);
      await user.type(field, `Failure ${status}`);
      await user.click(screen.getByRole("button", { name: "Save Changes" }));
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveAttribute("data-state", state);
      expect(alert).toHaveTextContent(message);
      failed.unmount();
    }

    server.use(http.put(userUrl("1"), () => HttpResponse.error()));
    renderTestApplication({ initialPath: "/admin/users/1/edit", sessionStore: adminSession() });
    const offlineName = await screen.findByRole("textbox", { name: /Full Name/ });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    await user.clear(offlineName);
    await user.type(offlineName, "Offline User");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    const offlineAlert = await screen.findByRole("alert");
    expect(offlineAlert).toHaveAttribute("data-state", "offline");
    expect(offlineAlert).toHaveTextContent("You are offline");
  });

  it("reconciles unknown update outcomes and exposes Check latest when reconciliation itself is unavailable", async () => {
    let current = { ...john };
    let puts = 0;
    server.use(
      http.get(userUrl("1"), () => HttpResponse.json({ content: [current] })),
      http.put(userUrl("1"), async ({ request }) => {
        puts += 1;
        const body = await request.json() as Record<string, unknown>;
        current = { ...current, name: String(body.name ?? current.name) };
        return HttpResponse.error();
      }),
    );
    const user = userEvent.setup();
    const reconciled = renderTestApplication({ initialPath: "/admin/users/1/edit", sessionStore: adminSession() });
    const name = await screen.findByRole("textbox", { name: /Full Name/ });
    await user.clear(name);
    await user.type(name, "Reconciled User");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(reconciled.currentLocation()).toBe("/admin/users/1"));
    expect(await screen.findByText(/updated successfully after reconciliation/)).toHaveAttribute("data-state", "confirmed-success");
    expect(puts).toBe(1);
    reconciled.unmount();

    let reads = 0;
    server.use(
      http.get(userUrl("1"), () => {
        reads += 1;
        return reads <= 2 ? HttpResponse.json({ content: [john] }) : HttpResponse.error();
      }),
      http.put(userUrl("1"), () => HttpResponse.error()),
    );
    renderTestApplication({ initialPath: "/admin/users/1/edit", sessionStore: adminSession() });
    const retryName = await screen.findByRole("textbox", { name: /Full Name/ });
    await user.clear(retryName);
    await user.type(retryName, "Unknown User");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    const unknown = await screen.findByRole("alert");
    expect(unknown).toHaveAttribute("data-state", "unknown-outcome");
    expect(unknown).toHaveTextContent("Could not reconcile");
    expect(within(unknown).getByRole("button", { name: "Check latest" })).toBeVisible();
  });

  it("reconciles an unknown delete outcome without resubmitting the destructive mutation", async () => {
    let deleted = false;
    let deletes = 0;
    server.use(
      http.get(userUrl("1"), () => deleted
        ? HttpResponse.json({ message: "Not found" }, { status: 404 })
        : HttpResponse.json({ content: [john] })),
      http.delete(usersUrl, () => {
        deletes += 1;
        deleted = true;
        return HttpResponse.error();
      }),
    );
    const application = renderTestApplication({ initialPath: "/admin/users/1", sessionStore: adminSession() });
    const user = userEvent.setup();
    await screen.findByText("john@example.com");
    await user.click(screen.getByRole("button", { name: "Delete John Doe" }));
    await fillTypedConfirmation("john@example.com", "Confirm Delete for John Doe");
    await waitFor(() => expect(application.currentLocation()).toBe("/admin/users"));
    expect(await screen.findByText(/deleted successfully/)).toHaveAttribute("data-state", "confirmed-success");
    expect(deletes).toBe(1);
  });

  it("keeps responsive data, forms, dialogs and actions available at 375, 768 and 1440 px", async () => {
    const user = userEvent.setup();
    for (const width of [375, 768, 1440]) {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      window.dispatchEvent(new Event("resize"));
      const list = renderTestApplication({ initialPath: "/admin/users", sessionStore: adminSession() });
      const table = await screen.findByRole("grid", { name: "User list" });
      const row = within(table).getAllByRole("row")[1];
      expect(within(row).getByText("john@example.com").closest("td")).toHaveAttribute("data-label", "Email");
      expect(within(row).getByRole("link", { name: "View John Doe" })).toBeVisible();
      expect(within(row).getByRole("link", { name: "Edit John Doe" })).toBeVisible();
      expect(within(row).getByRole("button", { name: "Delete John Doe" })).toBeVisible();
      list.unmount();

      const edit = renderTestApplication({ initialPath: "/admin/users/1/edit", sessionStore: adminSession() });
      await screen.findByRole("textbox", { name: /Full Name/ });
      expect(screen.getByRole("combobox", { name: /Role/ })).toBeVisible();
      await user.click(screen.getByRole("button", { name: "Delete John Doe" }));
      const dialog = screen.getByRole("dialog", { name: "Delete John Doe?" });
      expect(within(dialog).getByRole("textbox", { name: "Type john@example.com to confirm" })).toBeVisible();
      expect(within(dialog).getByRole("button", { name: /Cancel confirm delete/ })).toHaveFocus();
      edit.unmount();
    }
  });
});
