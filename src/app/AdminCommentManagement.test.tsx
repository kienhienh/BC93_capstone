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
const serviceTwo = { id: 2, tenCongViec: "Business Card Service" };
const authorOne = { id: 5, name: "Ada Lovelace" };
const commentOne = { id: 100, maCongViec: 1, maNguoiBinhLuan: 5, ngayBinhLuan: "2025-01-01", noiDung: "Great work", saoBinhLuan: 5 };
const commentTwo = { id: 101, maCongViec: 2, maNguoiBinhLuan: 6, ngayBinhLuan: "2025-02-02", noiDung: "Solid delivery", saoBinhLuan: 4 };

function installDefaultHandlers() {
  server.use(
    http.get(commentsUrl, () => HttpResponse.json({ content: [commentOne, commentTwo] })),
    http.get(servicesUrl, () => HttpResponse.json({ content: [serviceOne, serviceTwo] })),
    http.get(usersUrl, () => HttpResponse.json({ content: [authorOne, { id: 6, name: "Grace Hopper" }] })),
    http.get(byServiceUrl("1"), () => HttpResponse.json({ content: [
      { id: 100, ngayBinhLuan: "2025-01-01", noiDung: "Great work", saoBinhLuan: 5, tenNguoiBinhLuan: "Ada Lovelace", avatar: null },
    ] })),
    http.get(byServiceUrl("2"), () => HttpResponse.json({ content: [
      { id: 101, ngayBinhLuan: "2025-02-02", noiDung: "Solid delivery", saoBinhLuan: 4, tenNguoiBinhLuan: "Grace Hopper", avatar: null },
    ] })),
  );
}

async function heading(name: string) {
  return screen.findByRole("heading", { name }, { timeout: 5_000 });
}

describe("Administrator Comment Management", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    installDefaultHandlers();
  });

  it("turns Comments into a real Admin destination and preserves q/page/pageSize through routes", async () => {
    const query = "?q=great&page=1&pageSize=25";
    const app = renderTestApplication({ initialPath: `/admin/comments${query}`, isAdmin: true });
    const grid = await screen.findByRole("grid", { name: "Comment list" }, { timeout: 5_000 });
    expect(app.currentLocation()).toBe(`/admin/comments${query}`);
    expect(within(grid).getByRole("link", { name: "View Comment 100" })).toHaveAttribute("href", `/admin/comments/100${query}`);
    expect(within(grid).getByRole("link", { name: "Edit Comment 100" })).toHaveAttribute("href", `/admin/comments/100/edit${query}`);
    expect(screen.getByRole("link", { name: /Create Comment/ })).toHaveAttribute("href", `/admin/comments/new${query}`);
    app.unmount();

    const detail = renderTestApplication({ initialPath: `/admin/comments/100${query}`, isAdmin: true });
    await heading("Comment Detail");
    expect(await screen.findByText("Ada Lovelace")).toBeVisible();
    expect(await screen.findByText("Logo Design Service")).toBeVisible();
    expect(await screen.findByRole("link", { name: "Back to list" })).toHaveAttribute("href", `/admin/comments${query}`);
    expect(screen.getByRole("link", { name: "Edit Comment" })).toHaveAttribute("href", `/admin/comments/100/edit${query}`);
    detail.unmount();

    renderTestApplication({ initialPath: `/admin/comments/100/edit${query}`, isAdmin: true });
    await heading("Edit Comment");
    expect(await screen.findByRole("link", { name: "Cancel" })).toHaveAttribute("href", `/admin/comments${query}`);
  });

  it("filters and paginates entirely client-side because the Comment API has no working search", async () => {
    const app = renderTestApplication({ initialPath: "/admin/comments", isAdmin: true });
    await screen.findByRole("grid", { name: "Comment list" });
    expect(screen.getByText(/does not support server-side search or pagination/)).toBeVisible();
    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox", { name: /Search Comments/ }), "missing-keyword");
    await waitFor(() => expect(app.currentLocation()).toBe("/admin/comments?q=missing-keyword&page=1&pageSize=10"));
    expect(await screen.findByText(/No Comments match your search/)).toHaveAttribute("data-state", "query-empty");
  });

  it("creates a Comment authored by the signed-in Administrator and verifies the Service exists before submitting", async () => {
    let posts = 0;
    let postBody: { maCongViec: number; maNguoiBinhLuan: number } | undefined;
    server.use(http.post(commentsUrl, async ({ request }) => {
      posts += 1;
      postBody = await request.json() as typeof postBody;
      return HttpResponse.json({ content: { id: 102, maCongViec: 1, maNguoiBinhLuan: 900, ngayBinhLuan: "2025-03-03", noiDung: "New comment", saoBinhLuan: 5 } });
    }));
    const app = renderTestApplication({ initialPath: "/admin/comments/new", isAdmin: true });
    const user = userEvent.setup();
    await heading("Create Comment");
    expect(screen.getByText(/posted as Admin User/)).toBeVisible();
    expect(screen.queryByRole("combobox", { name: /author/i })).not.toBeInTheDocument();
    await user.selectOptions(await screen.findByRole("combobox", { name: /Service/ }), "1");
    await user.type(screen.getByRole("textbox", { name: /Comment content/ }), "New comment");
    await user.click(screen.getByRole("button", { name: "Create Comment" }));
    await waitFor(() => expect(posts).toBe(1));
    expect(postBody?.maCongViec).toBe(1);
    expect(postBody?.maNguoiBinhLuan).toBe(900);
    await waitFor(() => expect(app.currentLocation()).toBe("/admin/comments"));
  });

  it("edits a Comment's content and rating while preserving author, Service, and date", async () => {
    let putBody: Record<string, unknown> | undefined;
    server.use(http.put(commentUrl("100"), async ({ request }) => {
      putBody = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ content: null });
    }));
    const app = renderTestApplication({ initialPath: "/admin/comments/100/edit", isAdmin: true });
    const user = userEvent.setup();
    const content = await screen.findByRole("textbox", { name: /Comment content/ }, { timeout: 5_000 });
    expect(content).toHaveValue("Great work");
    await user.clear(content);
    await user.type(content, "Even better work");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(putBody).toEqual({
      id: 100, maCongViec: 1, maNguoiBinhLuan: 5, ngayBinhLuan: "2025-01-01", noiDung: "Even better work", saoBinhLuan: 5,
    }));
    await waitFor(() => expect(app.currentLocation()).toBe("/admin/comments/100"));
  });

  it("shows a non-blocking partial relation failure and falls back to numeric identifiers", async () => {
    server.use(http.get(usersUrl, () => HttpResponse.error()));
    renderTestApplication({ initialPath: "/admin/comments", isAdmin: true });
    await screen.findByRole("grid", { name: "Comment list" });
    const banner = await screen.findByText(/Some Service or User names could not be loaded/);
    expect(banner.closest('[role="status"]')).toHaveAttribute("data-state", "partial-relation-failure");
    expect(screen.getByText("User #5")).toBeVisible();
    expect(screen.getByText("Logo Design Service")).toBeVisible();
  });

  it("distinguishes not-found and forbidden failures", async () => {
    const missing = renderTestApplication({ initialPath: "/admin/comments/999999", isAdmin: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("Comment not found.");
    missing.unmount();

    server.use(http.get(commentsUrl, () => HttpResponse.json({ message: "forbidden" }, { status: 403 })));
    renderTestApplication({ initialPath: "/admin/comments", isAdmin: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("Access forbidden");
  });

  it.each([375, 768, 1440])("keeps Comment list, detail actions and forms available at %i px", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    window.dispatchEvent(new Event("resize"));
    const list = renderTestApplication({ initialPath: "/admin/comments", isAdmin: true });
    expect(await screen.findByRole("grid", { name: "Comment list" })).toBeVisible();
    expect(screen.getByRole("link", { name: "View Comment 100" })).toBeVisible();
    list.unmount();

    const detail = renderTestApplication({ initialPath: "/admin/comments/100", isAdmin: true });
    await heading("Comment Detail");
    expect(await screen.findByRole("navigation", { name: "Comment detail actions" })).toBeVisible();
    detail.unmount();

    renderTestApplication({ initialPath: "/admin/comments/new", isAdmin: true });
    await heading("Create Comment");
    expect(await screen.findByRole("textbox", { name: /Comment content/ })).toBeVisible();
  });
});
