import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderTestApplication } from "../test/render-application";
import { server } from "../test/server";

const apiBaseUrl = "http://api.example.test/api";
const categoriesUrl = `${apiBaseUrl}/loai-cong-viec`;
const pagingUrl = `${categoriesUrl}/phan-trang-tim-kiem`;
const categoryUrl = (id: string) => `${categoriesUrl}/${id}`;
const hierarchyUrl = (id: string) => `${apiBaseUrl}/cong-viec/lay-chi-tiet-loai-cong-viec/${id}`;
const category = { id: 1, tenLoaiCongViec: "Graphics & Design" };
const hierarchyWithDependencies = { content: [{
  id: 1,
  tenLoaiCongViec: "Graphics & Design",
  dsNhomChiTietLoai: [{ id: 10, tenNhom: "Logo & Brand Identity", hinhAnh: null, dsChiTietLoai: [{ id: 100, tenChiTiet: "Logo Design" }] }],
}] };
const emptyHierarchy = { content: [{ id: 1, tenLoaiCongViec: "Graphics & Design", dsNhomChiTietLoai: [] }] };

function defaults() {
  server.use(
    http.get(pagingUrl, () => HttpResponse.json({ content: { pageIndex: 1, pageSize: 10, totalRow: 1, keywords: null, data: [category] } })),
    http.get(categoriesUrl, () => HttpResponse.json({ content: [category, { id: 2, tenLoaiCongViec: "Digital Marketing" }] })),
    http.get(categoryUrl("1"), () => HttpResponse.json({ content: [category] })),
    http.get(hierarchyUrl("1"), () => HttpResponse.json(hierarchyWithDependencies)),
  );
}

async function typeDeleteConfirmation() {
  const user = userEvent.setup();
  const dialog = screen.getByRole("dialog", { name: "Delete Service Category?" });
  await user.type(within(dialog).getByRole("textbox", { name: "Type Graphics & Design to confirm" }), "Graphics & Design");
  await user.click(within(dialog).getByRole("button", { name: "Delete Graphics & Design" }));
  return user;
}

describe("Administrator Service Category safeguards", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    defaults();
  });

  it("focuses the least destructive dialog action and blocks deletion when Group/Subcategory dependencies exist", async () => {
    let deletes = 0;
    server.use(http.delete(categoryUrl("1"), () => { deletes += 1; return HttpResponse.json({ content: null }); }));
    renderTestApplication({ initialPath: "/admin/categories/1", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Service Category Detail" });
    await user.click(await screen.findByRole("button", { name: "Delete Graphics & Design" }));
    const dialog = screen.getByRole("dialog", { name: "Delete Service Category?" });
    expect(within(dialog).getByRole("button", { name: "Cancel delete for Graphics & Design" })).toHaveFocus();
    expect(within(dialog).getByText(/No cascade, reparenting, or cleanup/)).toBeVisible();
    await typeDeleteConfirmation();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("data-state", "blocked-dependency");
    expect(alert).toHaveTextContent("1 Service Group and 1 Service Subcategory");
    expect(screen.queryByText(/force delete/i)).not.toBeInTheDocument();
    expect(deletes).toBe(0);
  });

  it("blocks deletion when dependency absence cannot be proven", async () => {
    let deletes = 0;
    server.use(
      http.get(hierarchyUrl("1"), () => HttpResponse.error()),
      http.delete(categoryUrl("1"), () => { deletes += 1; return HttpResponse.json({ content: null }); }),
    );
    renderTestApplication({ initialPath: "/admin/categories/1", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Service Category Detail" });
    await user.click(await screen.findByRole("button", { name: "Delete Graphics & Design" }));
    await typeDeleteConfirmation();
    const guardText = await screen.findByText(/dependencies could not be proven absent/);
    const alert = guardText.closest('[role="alert"]');
    expect(alert).toHaveAttribute("data-state", "blocked-dependency");
    expect(deletes).toBe(0);
  });

  it("deletes only after a fresh unchanged target and a proven empty hierarchy", async () => {
    let deletes = 0;
    server.use(
      http.get(hierarchyUrl("1"), () => HttpResponse.json(emptyHierarchy)),
      http.delete(categoryUrl("1"), () => { deletes += 1; return HttpResponse.json({ content: null }); }),
    );
    const app = renderTestApplication({ initialPath: "/admin/categories/1?page=1&pageSize=10", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Service Category Detail" });
    await user.click(await screen.findByRole("button", { name: "Delete Graphics & Design" }));
    await typeDeleteConfirmation();
    await waitFor(() => expect(deletes).toBe(1));
    await waitFor(() => expect(app.currentLocation()).toBe("/admin/categories?page=1&pageSize=10"));
  });

  it("blocks stale update and stale delete with Reload latest and no force path", async () => {
    const changed = { id: 1, tenLoaiCongViec: "Server Renamed Category" };
    let reads = 0;
    let puts = 0;
    server.use(
      http.get(categoryUrl("1"), () => {
        reads += 1;
        return HttpResponse.json({ content: [reads === 1 ? category : changed] });
      }),
      http.put(categoryUrl("1"), () => { puts += 1; return HttpResponse.json({ content: changed }); }),
    );
    const edit = renderTestApplication({ initialPath: "/admin/categories/1/edit", isAdmin: true });
    const user = userEvent.setup();
    const input = await screen.findByRole("textbox", { name: /Service Category name/ });
    await user.clear(input);
    await user.type(input, "Local Category Name");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    const stale = await screen.findByRole("alert");
    expect(stale).toHaveAttribute("data-state", "stale");
    expect(within(stale).getByRole("button", { name: "Reload latest" })).toBeVisible();
    expect(puts).toBe(0);
    expect(screen.queryByText(/force overwrite/i)).not.toBeInTheDocument();
    edit.unmount();

    reads = 0;
    let deletes = 0;
    server.use(
      http.get(categoryUrl("1"), () => {
        reads += 1;
        return HttpResponse.json({ content: [reads === 1 ? category : changed] });
      }),
      http.get(hierarchyUrl("1"), () => HttpResponse.json(emptyHierarchy)),
      http.delete(categoryUrl("1"), () => { deletes += 1; return HttpResponse.json({ content: null }); }),
    );
    renderTestApplication({ initialPath: "/admin/categories/1", isAdmin: true });
    await screen.findByRole("heading", { name: "Service Category Detail" });
    await user.click(await screen.findByRole("button", { name: "Delete Graphics & Design" }));
    await typeDeleteConfirmation();
    const deleteStale = await screen.findByRole("alert");
    expect(deleteStale).toHaveAttribute("data-state", "stale");
    expect(deletes).toBe(0);
  });

  it("reconciles an unknown update outcome without automatically resending the mutation", async () => {
    const updated = { id: 1, tenLoaiCongViec: "Creative Design" };
    let reads = 0;
    let puts = 0;
    server.use(
      http.get(categoryUrl("1"), () => {
        reads += 1;
        return HttpResponse.json({ content: [reads >= 3 ? updated : category] });
      }),
      http.put(categoryUrl("1"), () => { puts += 1; return HttpResponse.error(); }),
    );
    const app = renderTestApplication({ initialPath: "/admin/categories/1/edit", isAdmin: true });
    const user = userEvent.setup();
    const input = await screen.findByRole("textbox", { name: /Service Category name/ });
    await user.clear(input);
    await user.type(input, "Creative Design");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(app.currentLocation()).toBe("/admin/categories/1"));
    expect(puts).toBe(1);
  });

  it("reconciles an unknown delete outcome without resubmitting DELETE", async () => {
    let reads = 0;
    let deletes = 0;
    server.use(
      http.get(categoryUrl("1"), () => {
        reads += 1;
        if (reads >= 3) return HttpResponse.json({ message: "not found" }, { status: 404 });
        return HttpResponse.json({ content: [category] });
      }),
      http.get(hierarchyUrl("1"), () => HttpResponse.json(emptyHierarchy)),
      http.delete(categoryUrl("1"), () => { deletes += 1; return HttpResponse.error(); }),
    );
    const app = renderTestApplication({ initialPath: "/admin/categories/1", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Service Category Detail" });
    await user.click(await screen.findByRole("button", { name: "Delete Graphics & Design" }));
    await typeDeleteConfirmation();
    await waitFor(() => expect(app.currentLocation()).toBe("/admin/categories"));
    expect(deletes).toBe(1);
  });

  it("warns before navigation with unsaved non-secret Category work and focuses Stay", async () => {
    renderTestApplication({ initialPath: "/admin/categories/1/edit", isAdmin: true });
    const user = userEvent.setup();
    const input = await screen.findByRole("textbox", { name: /Service Category name/ });
    await user.type(input, " changed");
    await user.click(screen.getByRole("link", { name: "Cancel" }));
    const dialog = screen.getByRole("dialog", { name: "Leave with unsaved changes?" });
    expect(within(dialog).getByRole("button", { name: "Stay and keep editing" })).toHaveFocus();
    expect(within(dialog).getByText(/non-secret Service Category name change/)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Stay and keep editing" }));
    expect(screen.getByRole("textbox", { name: /Service Category name/ })).toHaveValue("Graphics & Design changed");
  });

  it.each([375, 768, 1440])("keeps destructive confirmation keyboard-safe at %i px", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    window.dispatchEvent(new Event("resize"));
    renderTestApplication({ initialPath: "/admin/categories/1", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Service Category Detail" });
    const trigger = await screen.findByRole("button", { name: "Delete Graphics & Design" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Delete Service Category?" });
    const cancel = within(dialog).getByRole("button", { name: "Cancel delete for Graphics & Design" });
    expect(cancel).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
