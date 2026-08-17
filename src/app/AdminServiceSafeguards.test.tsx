import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderTestApplication } from "../test/render-application";
import { server } from "../test/server";

const apiBaseUrl = "http://api.example.test/api";
const servicesListUrl = `${apiBaseUrl}/cong-viec/phan-trang-tim-kiem`;
const servicesUrl = `${apiBaseUrl}/cong-viec`;
const serviceUrl = (id: string) => `${servicesUrl}/${id}`;
const usersUrl = `${apiBaseUrl}/users`;
const hiresUrl = `${apiBaseUrl}/thue-cong-viec`;

const alice = { id: 100, name: "Alice Seller", email: "alice@example.com", phone: "", birthday: "", avatar: null, gender: true, role: "USER", skill: [], certification: [] };
const bob = { id: 101, name: "Bob Seller", email: "bob@example.com", phone: "", birthday: "", avatar: null, gender: true, role: "USER", skill: [], certification: [] };
const noEmailSeller = { id: 102, name: "No Email Seller", email: "", phone: "", birthday: "", avatar: null, gender: true, role: "USER", skill: [], certification: [] };

const serviceOne = {
  id: 1,
  tenCongViec: "Design a modern logo",
  moTa: "Full logo description",
  moTaNgan: "Short logo pitch",
  giaTien: 25,
  hinhAnh: null,
  saoCongViec: 4,
  danhGia: 12,
  nguoiTao: 100,
  maChiTietLoaiCongViec: 100,
  tenNguoiTao: "Alice Seller",
};

function listResponse(data = [serviceOne], totalRow = 60, pageIndex = 1, pageSize = 10) {
  return { content: { pageIndex, pageSize, totalRow, keywords: null, data } };
}

function installDefaultHandlers() {
  server.use(
    http.get(servicesListUrl, ({ request }) => {
      const url = new URL(request.url);
      return HttpResponse.json(listResponse(
        [serviceOne],
        60,
        Number(url.searchParams.get("pageIndex") ?? 1),
        Number(url.searchParams.get("pageSize") ?? 10),
      ));
    }),
    http.get(servicesUrl, () => HttpResponse.json({ content: [serviceOne] })),
    http.get(serviceUrl("1"), () => HttpResponse.json({ content: [serviceOne] })),
    http.get(usersUrl, () => HttpResponse.json({ content: [alice, bob, noEmailSeller] })),
    http.get(`${usersUrl}/search/:name`, ({ params }) => {
      const needle = decodeURIComponent(String(params.name)).toLowerCase();
      return HttpResponse.json({ content: [alice, bob, noEmailSeller].filter((seller) => seller.name.toLowerCase().includes(needle)) });
    }),
    http.get(hiresUrl, () => HttpResponse.json({ content: [] })),
  );
}

async function findHeading(name: string) {
  return screen.findByRole("heading", { name }, { timeout: 5_000 });
}

async function fillTypedConfirmation(value: string, actionName: RegExp | string) {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: `Type ${value} to confirm` }), value);
  await user.click(screen.getByRole("button", { name: actionName }));
}

async function pickSeller(name: string) {
  const user = userEvent.setup();
  const picker = await screen.findByRole("combobox", { name: /Seller/ }, { timeout: 5_000 });
  await user.click(picker);
  await user.clear(picker);
  await user.type(picker, name);
  const option = await screen.findByRole("option", { name: new RegExp(name) });
  await user.click(option);
}

describe("Administrator Service safeguards", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    installDefaultHandlers();
  });

  it("preserves q/page/pageSize across list, detail, edit and delete entry points with unique action names", async () => {
    const query = "?q=logo&page=2&pageSize=25";
    const list = renderTestApplication({ initialPath: `/admin/services${query}`, isAdmin: true });
    await screen.findByRole("grid", { name: "Service list" }, { timeout: 5_000 });
    expect(list.currentLocation()).toBe(`/admin/services${query}`);
    expect(screen.getByRole("link", { name: "View Design a modern logo" })).toHaveAttribute("href", `/admin/services/1${query}`);
    expect(screen.getByRole("link", { name: "Edit Design a modern logo" })).toHaveAttribute("href", `/admin/services/1/edit${query}`);
    expect(screen.getByRole("button", { name: "Delete Design a modern logo" })).toBeVisible();
    list.unmount();

    const detail = renderTestApplication({ initialPath: `/admin/services/1${query}`, isAdmin: true });
    await findHeading("Service Detail");
    expect(await screen.findByRole("link", { name: "Back to list" })).toHaveAttribute("href", `/admin/services${query}`);
    expect(screen.getByRole("link", { name: "Edit Service" })).toHaveAttribute("href", `/admin/services/1/edit${query}`);
    expect(screen.getByRole("button", { name: "Delete Design a modern logo" })).toBeVisible();
    detail.unmount();

    renderTestApplication({ initialPath: `/admin/services/1/edit${query}`, isAdmin: true });
    await findHeading("Edit Service");
    expect(await screen.findByRole("link", { name: "Cancel" })).toHaveAttribute("href", `/admin/services${query}`);
    expect(await screen.findByRole("button", { name: "Delete Design a modern logo" })).toBeVisible();
  });

  it("opens ownership-transfer confirmation only when Seller changes, keyed to the new Seller's email", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(http.put(serviceUrl("1"), async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ content: { ...serviceOne, nguoiTao: body.nguoiTao, tenNguoiTao: "Bob Seller" } });
    }));
    const application = renderTestApplication({ initialPath: "/admin/services/1/edit", isAdmin: true });
    await findHeading("Edit Service");
    await pickSeller("Bob");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    const dialog = screen.getByRole("dialog", { name: "Confirm ownership transfer for Design a modern logo?" });
    expect(within(dialog).getByRole("button", { name: /Cancel confirm changes/ })).toHaveFocus();
    expect(within(dialog).getByText(/reassigns the Service from Alice Seller to Bob Seller/)).toBeVisible();
    await fillTypedConfirmation("bob@example.com", "Confirm Changes for Design a modern logo");
    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({ nguoiTao: 101, danhGia: 12 });
    await waitFor(() => expect(application.currentLocation()).toBe("/admin/services/1"));
  });

  it("does not open the transfer dialog when Seller is unchanged", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(http.put(serviceUrl("1"), async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ content: serviceOne });
    }));
    renderTestApplication({ initialPath: "/admin/services/1/edit", isAdmin: true });
    await findHeading("Edit Service");
    const user = userEvent.setup();
    const title = await screen.findByRole("textbox", { name: /Title/ }, { timeout: 5_000 });
    await user.clear(title);
    await user.type(title, "Design a refreshed logo");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(body).toBeDefined());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocks ownership transfer when the new Seller has no email for typed confirmation", async () => {
    let puts = 0;
    server.use(http.put(serviceUrl("1"), () => { puts += 1; return HttpResponse.json({ content: serviceOne }); }));
    renderTestApplication({ initialPath: "/admin/services/1/edit", isAdmin: true });
    await findHeading("Edit Service");
    await pickSeller("No Email");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("new Seller has no email for typed confirmation");
    expect(alert).toHaveAttribute("data-state", "blocked-dependency");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(puts).toBe(0);
  });

  it("refetches target evidence and blocks stale update/delete with Reload latest and no force path", async () => {
    const changed = { ...serviceOne, tenCongViec: "Server Changed Title" };
    let reads = 0;
    let puts = 0;
    server.use(
      http.get(serviceUrl("1"), () => {
        reads += 1;
        return HttpResponse.json({ content: [reads === 1 ? serviceOne : changed] });
      }),
      http.put(serviceUrl("1"), () => { puts += 1; return HttpResponse.json({ content: changed }); }),
    );
    const user = userEvent.setup();
    const edit = renderTestApplication({ initialPath: "/admin/services/1/edit", isAdmin: true });
    const title = await screen.findByRole("textbox", { name: /Title/ }, { timeout: 5_000 });
    await user.clear(title);
    await user.type(title, "Local Change");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    const stale = await screen.findByRole("alert");
    expect(stale).toHaveAttribute("data-state", "stale");
    expect(stale).toHaveTextContent("changed after you opened the form");
    expect(within(stale).getByRole("button", { name: "Reload latest" })).toBeVisible();
    expect(screen.queryByText(/force overwrite/i)).not.toBeInTheDocument();
    expect(puts).toBe(0);
    await user.click(within(stale).getByRole("button", { name: "Reload latest" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: /Title/ })).toHaveValue("Server Changed Title"));
    edit.unmount();

    reads = 0;
    let deletes = 0;
    server.use(
      http.get(serviceUrl("1"), () => {
        reads += 1;
        return HttpResponse.json({ content: [reads === 1 ? serviceOne : changed] });
      }),
      http.delete(serviceUrl("1"), () => { deletes += 1; return HttpResponse.json({ content: null }); }),
    );
    renderTestApplication({ initialPath: "/admin/services/1", isAdmin: true });
    await screen.findByText("Design a modern logo", {}, { timeout: 5_000 });
    await user.click(screen.getByRole("button", { name: "Delete Design a modern logo" }));
    await fillTypedConfirmation("Design a modern logo", /Confirm Delete/);
    const deleteStale = await screen.findByRole("alert");
    expect(deleteStale).toHaveAttribute("data-state", "stale");
    expect(within(deleteStale).getByRole("button", { name: "Reload latest" })).toBeVisible();
    expect(screen.getByText(/There is no cascade or force-delete path/)).toBeVisible();
    expect(deletes).toBe(0);
  });

  it("blocks delete when hires are proven and when the hires check itself cannot be completed", async () => {
    let deletes = 0;
    server.use(
      http.get(hiresUrl, () => HttpResponse.json({ content: [{ id: 1, maCongViec: 1, maNguoiThue: 5, ngayThue: "1/1/2026", hoanThanh: false }] })),
      http.delete(serviceUrl("1"), () => { deletes += 1; return HttpResponse.json({ content: null }); }),
    );
    const withHires = renderTestApplication({ initialPath: "/admin/services/1", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByText("Design a modern logo", {}, { timeout: 5_000 });
    await user.click(screen.getByRole("button", { name: "Delete Design a modern logo" }));
    await fillTypedConfirmation("Design a modern logo", /Confirm Delete/);
    const blocked = await screen.findByRole("alert");
    expect(blocked).toHaveAttribute("data-state", "blocked-dependency");
    expect(blocked).toHaveTextContent("recorded hires");
    expect(deletes).toBe(0);
    withHires.unmount();

    server.use(http.get(hiresUrl, () => HttpResponse.error()));
    renderTestApplication({ initialPath: "/admin/services/1", isAdmin: true });
    await screen.findByText("Design a modern logo", {}, { timeout: 5_000 });
    await user.click(screen.getByRole("button", { name: "Delete Design a modern logo" }));
    await fillTypedConfirmation("Design a modern logo", /Confirm Delete/);
    const unprovable = await screen.findByRole("alert");
    expect(unprovable).toHaveTextContent("Could not prove this Service has no hires");
    expect(deletes).toBe(0);
  });

  it("requires exact typed title, focuses Cancel first, traps focus, and restores the destructive trigger", async () => {
    renderTestApplication({ initialPath: "/admin/services/1", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByText("Design a modern logo", {}, { timeout: 5_000 });
    const trigger = screen.getByRole("button", { name: "Delete Design a modern logo" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Delete Design a modern logo?" });
    const cancel = within(dialog).getByRole("button", { name: /Cancel confirm delete/ });
    const confirm = within(dialog).getByRole("button", { name: /Confirm Delete/ });
    const titleField = within(dialog).getByRole("textbox", { name: "Type Design a modern logo to confirm" });
    expect(cancel).toHaveFocus();
    expect(confirm).toBeDisabled();
    await user.type(titleField, "Design a modern log");
    expect(confirm).toBeDisabled();
    await user.type(titleField, "o");
    expect(confirm).toBeEnabled();

    confirm.focus();
    await user.tab();
    expect(titleField).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await user.click(cancel);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("warns before navigating away with unsaved non-secret work and never persists the upload file", async () => {
    const application = renderTestApplication({ initialPath: "/admin/services/1/edit?q=logo&page=2&pageSize=25", isAdmin: true });
    const user = userEvent.setup();
    const title = await screen.findByRole("textbox", { name: /Title/ }, { timeout: 5_000 });
    await user.type(title, " changed");
    await user.click(screen.getByRole("link", { name: "Cancel" }));

    const dialog = screen.getByRole("dialog", { name: "Leave with unsaved changes?" });
    expect(within(dialog).getByRole("button", { name: "Stay and keep editing" })).toHaveFocus();
    expect(application.currentLocation()).toBe("/admin/services/1/edit?q=logo&page=2&pageSize=25");
    await user.click(within(dialog).getByRole("button", { name: "Stay and keep editing" }));
    expect(screen.queryByRole("dialog", { name: "Leave with unsaved changes?" })).not.toBeInTheDocument();

    const fileInput = screen.getByLabelText(/Upload a new image/);
    fireEvent.change(fileInput, { target: { files: [new File(["fake-bytes"], "logo.png", { type: "image/png" })] } });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);

    await user.click(screen.getByRole("link", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Leave without saving" }));
    await waitFor(() => expect(application.currentLocation()).toBe("/admin/services?q=logo&page=2&pageSize=25"));
  });

  it("reconciles unknown update outcomes and exposes Check latest when reconciliation itself is unavailable", async () => {
    let current = { ...serviceOne };
    let puts = 0;
    server.use(
      http.get(serviceUrl("1"), () => HttpResponse.json({ content: [current] })),
      http.put(serviceUrl("1"), async ({ request }) => {
        puts += 1;
        const body = await request.json() as Record<string, unknown>;
        current = { ...current, tenCongViec: String(body.tenCongViec ?? current.tenCongViec) };
        return HttpResponse.error();
      }),
    );
    const user = userEvent.setup();
    const reconciled = renderTestApplication({ initialPath: "/admin/services/1/edit", isAdmin: true });
    const title = await screen.findByRole("textbox", { name: /Title/ }, { timeout: 5_000 });
    await user.clear(title);
    await user.type(title, "Reconciled Title");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(reconciled.currentLocation()).toBe("/admin/services/1"));
    expect(await screen.findByText(/updated successfully after reconciliation/)).toHaveAttribute("data-state", "confirmed-success");
    expect(puts).toBe(1);
    reconciled.unmount();

    let reads = 0;
    server.use(
      http.get(serviceUrl("1"), () => {
        reads += 1;
        return reads <= 2 ? HttpResponse.json({ content: [serviceOne] }) : HttpResponse.error();
      }),
      http.put(serviceUrl("1"), () => HttpResponse.error()),
    );
    renderTestApplication({ initialPath: "/admin/services/1/edit", isAdmin: true });
    const retryTitle = await screen.findByRole("textbox", { name: /Title/ }, { timeout: 5_000 });
    await user.clear(retryTitle);
    await user.type(retryTitle, "Unknown Title");
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
      http.get(serviceUrl("1"), () => deleted
        ? HttpResponse.json({ message: "Not found" }, { status: 404 })
        : HttpResponse.json({ content: [serviceOne] })),
      http.delete(serviceUrl("1"), () => {
        deletes += 1;
        deleted = true;
        return HttpResponse.error();
      }),
    );
    const application = renderTestApplication({ initialPath: "/admin/services/1", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByText("Design a modern logo", {}, { timeout: 5_000 });
    await user.click(screen.getByRole("button", { name: "Delete Design a modern logo" }));
    await fillTypedConfirmation("Design a modern logo", /Confirm Delete/);
    await waitFor(() => expect(application.currentLocation()).toBe("/admin/services"));
    expect(await screen.findByText(/deleted successfully/)).toHaveAttribute("data-state", "confirmed-success");
    expect(deletes).toBe(1);
  });

  it("keeps responsive data, forms, Seller picker, image controls and dialogs available at 375, 768 and 1440 px", async () => {
    const user = userEvent.setup();
    for (const width of [375, 768, 1440]) {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      window.dispatchEvent(new Event("resize"));
      const list = renderTestApplication({ initialPath: "/admin/services", isAdmin: true });
      const table = await screen.findByRole("grid", { name: "Service list" }, { timeout: 5_000 });
      const row = within(table).getAllByRole("row")[1];
      expect(within(row).getByText("Alice Seller").closest("td")).toHaveAttribute("data-label", "Seller");
      expect(within(row).getByRole("link", { name: "View Design a modern logo" })).toBeVisible();
      expect(within(row).getByRole("link", { name: "Edit Design a modern logo" })).toBeVisible();
      expect(within(row).getByRole("button", { name: "Delete Design a modern logo" })).toBeVisible();
      list.unmount();

      const edit = renderTestApplication({ initialPath: "/admin/services/1/edit", isAdmin: true });
      await screen.findByRole("textbox", { name: /Title/ }, { timeout: 5_000 });
      expect(screen.getByRole("combobox", { name: /Seller/ })).toBeVisible();
      expect(screen.getByLabelText(/Upload a new image/)).toBeVisible();
      await user.click(screen.getByRole("button", { name: "Delete Design a modern logo" }));
      const dialog = screen.getByRole("dialog", { name: "Delete Design a modern logo?" });
      expect(within(dialog).getByRole("textbox", { name: "Type Design a modern logo to confirm" })).toBeVisible();
      expect(within(dialog).getByRole("button", { name: /Cancel confirm delete/ })).toHaveFocus();
      edit.unmount();
    }
  });
});
