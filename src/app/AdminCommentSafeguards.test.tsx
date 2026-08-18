import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderTestApplication } from "../test/render-application";
import { server } from "../test/server";

const apiBaseUrl = "http://api.example.test/api";
const commentsUrl = `${apiBaseUrl}/binh-luan`;
const commentUrl = (id: string) => `${commentsUrl}/${id}`;
const byServiceUrl = (id: string) => `${commentsUrl}/lay-binh-luan-theo-cong-viec/${id}`;
const servicesUrl = `${apiBaseUrl}/cong-viec`;
const usersUrl = `${apiBaseUrl}/users`;

const serviceOne = { id: 1, tenCongViec: "Logo Design Service" };
const authorOne = { id: 5, name: "Ada Lovelace" };
const commentOne = { id: 100, maCongViec: 1, maNguoiBinhLuan: 5, ngayBinhLuan: "2025-01-01", noiDung: "Great work", saoBinhLuan: 5 };

function defaults() {
  server.use(
    http.get(commentsUrl, () => HttpResponse.json({ content: [commentOne] })),
    http.get(servicesUrl, () => HttpResponse.json({ content: [serviceOne] })),
    http.get(usersUrl, () => HttpResponse.json({ content: [authorOne] })),
    http.get(byServiceUrl("1"), () => HttpResponse.json({ content: [
      { id: 100, ngayBinhLuan: "2025-01-01", noiDung: "Great work", saoBinhLuan: 5, tenNguoiBinhLuan: "Ada Lovelace", avatar: null },
    ] })),
  );
}

describe("Administrator Comment safeguards", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    defaults();
  });

  it("blocks a stale edit with Reload latest and sends no PUT", async () => {
    let puts = 0;
    server.use(
      http.get(byServiceUrl("1"), () => HttpResponse.json({ content: [
        { id: 100, ngayBinhLuan: "2025-01-01", noiDung: "Changed elsewhere", saoBinhLuan: 5, tenNguoiBinhLuan: "Ada Lovelace", avatar: null },
      ] })),
      http.put(commentUrl("100"), () => { puts += 1; return HttpResponse.json({ content: null }); }),
    );
    renderTestApplication({ initialPath: "/admin/comments/100/edit", isAdmin: true });
    const user = userEvent.setup();
    const content = await screen.findByRole("textbox", { name: /Comment content/ }, { timeout: 5_000 });
    await user.type(content, " more");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    const stale = await screen.findByRole("alert");
    expect(stale).toHaveAttribute("data-state", "stale");
    expect(within(stale).getByRole("button", { name: "Reload latest" })).toBeVisible();
    expect(puts).toBe(0);
  });

  it("blocks a stale delete with Reload latest and sends no DELETE", async () => {
    let deletes = 0;
    server.use(
      http.get(byServiceUrl("1"), () => HttpResponse.json({ content: [
        { id: 100, ngayBinhLuan: "2025-01-01", noiDung: "Changed elsewhere", saoBinhLuan: 5, tenNguoiBinhLuan: "Ada Lovelace", avatar: null },
      ] })),
      http.delete(commentUrl("100"), () => { deletes += 1; return HttpResponse.json({ content: null }); }),
    );
    renderTestApplication({ initialPath: "/admin/comments/100", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Comment Detail" });
    await user.click(await screen.findByRole("button", { name: "Delete Comment 100" }));
    const dialog = screen.getByRole("dialog", { name: "Delete Comment?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete Comment 100" }));
    const stale = await screen.findByRole("alert");
    expect(stale).toHaveAttribute("data-state", "stale");
    expect(deletes).toBe(0);
  });

  it("reconciles an unknown update outcome without resubmitting the mutation", async () => {
    let puts = 0;
    let evidenceComment = { id: 100, ngayBinhLuan: "2025-01-01", noiDung: "Great work", saoBinhLuan: 5, tenNguoiBinhLuan: "Ada Lovelace", avatar: null };
    server.use(
      http.get(byServiceUrl("1"), () => HttpResponse.json({ content: [evidenceComment] })),
      http.put(commentUrl("100"), () => {
        puts += 1;
        evidenceComment = { ...evidenceComment, noiDung: "Reconciled content" };
        return HttpResponse.error();
      }),
    );
    const app = renderTestApplication({ initialPath: "/admin/comments/100/edit", isAdmin: true });
    const user = userEvent.setup();
    const content = await screen.findByRole("textbox", { name: /Comment content/ }, { timeout: 5_000 });
    await user.clear(content);
    await user.type(content, "Reconciled content");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(app.currentLocation()).toBe("/admin/comments/100"));
    expect(puts).toBe(1);
  });

  it("reconciles an unknown delete outcome without resubmitting DELETE", async () => {
    let deletes = 0;
    let evidence: unknown[] = [{ id: 100, ngayBinhLuan: "2025-01-01", noiDung: "Great work", saoBinhLuan: 5, tenNguoiBinhLuan: "Ada Lovelace", avatar: null }];
    server.use(
      http.get(byServiceUrl("1"), () => HttpResponse.json({ content: evidence })),
      http.delete(commentUrl("100"), () => { deletes += 1; evidence = []; return HttpResponse.error(); }),
    );
    const app = renderTestApplication({ initialPath: "/admin/comments/100", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Comment Detail" });
    await user.click(await screen.findByRole("button", { name: "Delete Comment 100" }));
    const dialog = screen.getByRole("dialog", { name: "Delete Comment?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete Comment 100" }));
    await waitFor(() => expect(app.currentLocation()).toBe("/admin/comments"));
    expect(deletes).toBe(1);
  });

  it("blocks creating a Comment for a Service that no longer exists", async () => {
    let posts = 0;
    server.use(http.post(commentsUrl, () => { posts += 1; return HttpResponse.json({ content: null }); }));
    renderTestApplication({ initialPath: "/admin/comments/new", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Create Comment" });
    await user.selectOptions(await screen.findByRole("combobox", { name: /Service/ }), "1");
    await user.type(screen.getByRole("textbox", { name: /Comment content/ }), "New comment");
    server.use(http.get(servicesUrl, () => HttpResponse.json({ content: [] })));
    await user.click(screen.getByRole("button", { name: "Create Comment" }));
    expect(await screen.findByText(/This Service no longer exists/)).toBeVisible();
    expect(posts).toBe(0);
  });

  it("warns before navigation with unsaved Comment work and focuses Stay", async () => {
    renderTestApplication({ initialPath: "/admin/comments/100/edit", isAdmin: true });
    const user = userEvent.setup();
    const content = await screen.findByRole("textbox", { name: /Comment content/ }, { timeout: 5_000 });
    await user.type(content, " changed");
    await user.click(screen.getByRole("link", { name: "Cancel" }));
    const dialog = screen.getByRole("dialog", { name: "Leave with unsaved changes?" });
    expect(within(dialog).getByRole("button", { name: "Stay and keep editing" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Stay and keep editing" }));
    expect(screen.getByRole("textbox", { name: /Comment content/ })).toHaveValue("Great work changed");
  });

  it.each([375, 768, 1440])("keeps destructive confirmation keyboard-safe at %i px", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    window.dispatchEvent(new Event("resize"));
    renderTestApplication({ initialPath: "/admin/comments/100", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Comment Detail" });
    const trigger = await screen.findByRole("button", { name: "Delete Comment 100" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Delete Comment?" });
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("traps Tab focus within the destructive confirmation dialog", async () => {
    renderTestApplication({ initialPath: "/admin/comments/100", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Comment Detail" });
    await user.click(await screen.findByRole("button", { name: "Delete Comment 100" }));
    const dialog = screen.getByRole("dialog", { name: "Delete Comment?" });
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    const confirm = within(dialog).getByRole("button", { name: "Delete Comment 100" });
    expect(cancel).toHaveFocus();

    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();

    await user.tab();
    expect(cancel).toHaveFocus();
  });
});
