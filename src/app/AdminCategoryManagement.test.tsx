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
const categoryOne = { id: 1, tenLoaiCongViec: "Graphics & Design" };
const categoryTwo = { id: 2, tenLoaiCongViec: "Digital Marketing" };

function paging(data = [categoryOne], totalRow = 60, pageIndex = 1, pageSize = 10, keywords: string | null = null) {
  return { content: { pageIndex, pageSize, totalRow, keywords, data } };
}

function hierarchy(groups: unknown[] = [{
  id: 10,
  tenNhom: "Logo & Brand Identity",
  hinhAnh: null,
  dsChiTietLoai: [{ id: 100, tenChiTiet: "Logo Design" }],
}]) {
  return { content: [{ id: 1, tenLoaiCongViec: "Graphics & Design", dsNhomChiTietLoai: groups }] };
}

function installDefaultHandlers() {
  server.use(
    http.get(pagingUrl, ({ request }) => {
      const url = new URL(request.url);
      return HttpResponse.json(paging(
        [categoryOne],
        60,
        Number(url.searchParams.get("pageIndex") ?? 1),
        Number(url.searchParams.get("pageSize") ?? 10),
        url.searchParams.get("keyword"),
      ));
    }),
    http.get(categoriesUrl, () => HttpResponse.json({ content: [categoryOne, categoryTwo] })),
    http.get(categoryUrl("1"), () => HttpResponse.json({ content: [categoryOne] })),
    http.get(categoryUrl("2"), () => HttpResponse.json({ content: [categoryTwo] })),
    http.get(hierarchyUrl("1"), () => HttpResponse.json(hierarchy())),
    http.get(hierarchyUrl("2"), () => HttpResponse.json({ content: [{ id: 2, tenLoaiCongViec: "Digital Marketing", dsNhomChiTietLoai: [] }] })),
  );
}

async function heading(name: string) {
  return screen.findByRole("heading", { name }, { timeout: 5_000 });
}

describe("Administrator Service Category Management", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    installDefaultHandlers();
  });

  it("turns Service Categories into a real Admin destination and preserves q/page/pageSize through routes", async () => {
    const query = "?q=design&page=2&pageSize=25";
    const app = renderTestApplication({ initialPath: `/admin/categories${query}`, isAdmin: true });
    const grid = await screen.findByRole("grid", { name: "Service Category list" }, { timeout: 5_000 });
    expect(app.currentLocation()).toBe(`/admin/categories${query}`);
    expect(within(grid).getByRole("link", { name: "View Graphics & Design" })).toHaveAttribute("href", `/admin/categories/1${query}`);
    expect(within(grid).getByRole("link", { name: "Edit Graphics & Design" })).toHaveAttribute("href", `/admin/categories/1/edit${query}`);
    expect(screen.getByRole("link", { name: /Create Category/ })).toHaveAttribute("href", `/admin/categories/new${query}`);
    app.unmount();

    const detail = renderTestApplication({ initialPath: `/admin/categories/1${query}`, isAdmin: true });
    await heading("Service Category Detail");
    expect(await screen.findByRole("link", { name: "Back to list" })).toHaveAttribute("href", `/admin/categories${query}`);
    expect(screen.getByRole("link", { name: "Edit Category" })).toHaveAttribute("href", `/admin/categories/1/edit${query}`);
    detail.unmount();

    renderTestApplication({ initialPath: `/admin/categories/1/edit${query}`, isAdmin: true });
    await heading("Edit Service Category");
    expect(await screen.findByRole("link", { name: "Cancel" })).toHaveAttribute("href", `/admin/categories${query}`);
  });

  it("normalizes URL state, searches, paginates and distinguishes empty from query-empty", async () => {
    const app = renderTestApplication({ initialPath: "/admin/categories?page=bad&pageSize=999", isAdmin: true });
    await screen.findByRole("grid", { name: "Service Category list" });
    await waitFor(() => expect(app.currentLocation()).toBe("/admin/categories?page=1&pageSize=10"));
    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox", { name: "Search Service Categories by name" }), "missing");
    server.use(http.get(pagingUrl, () => HttpResponse.json(paging([], 0, 1, 10, "missing"))));
    await user.click(screen.getByRole("button", { name: "Refresh Categories" }));
    expect(await screen.findByText(/No Service Categories match your search/)).toHaveAttribute("data-state", "query-empty");
    app.unmount();

    server.use(http.get(pagingUrl, () => HttpResponse.json(paging([], 0))));
    renderTestApplication({ initialPath: "/admin/categories", isAdmin: true });
    expect(await screen.findByText("No Service Categories found.")).toHaveAttribute("data-state", "empty");
  });

  it("renders the known Group/Subcategory hierarchy without inventing missing children", async () => {
    server.use(http.get(hierarchyUrl("1"), () => HttpResponse.json(hierarchy([
      { id: 10, tenNhom: "Logo & Brand Identity", hinhAnh: null, dsChiTietLoai: [{ id: 100, tenChiTiet: "Logo Design" }] },
      { id: 11, tenNhom: "Art & Illustration", hinhAnh: null, dsChiTietLoai: [] },
    ]))));
    renderTestApplication({ initialPath: "/admin/categories/1", isAdmin: true });
    await heading("Service Category Detail");
    expect(await screen.findByText("Logo & Brand Identity")).toBeVisible();
    expect(screen.getByText("Logo Design")).toBeVisible();
    expect(screen.getByText("Art & Illustration")).toBeVisible();
    expect(screen.getByText("No Service Subcategories are currently reported for this Group.")).toBeVisible();
    expect(screen.queryByText(/Unknown Group|Uncategorized|Other Subcategories/)).not.toBeInTheDocument();
  });

  it("creates a unique Category and attaches duplicate or server validation feedback to the name field", async () => {
    let posts = 0;
    server.use(http.post(categoriesUrl, async ({ request }) => {
      posts += 1;
      const body = await request.json() as { tenLoaiCongViec: string };
      return HttpResponse.json({ content: { id: 3, tenLoaiCongViec: body.tenLoaiCongViec } });
    }));
    const user = userEvent.setup();
    const duplicate = renderTestApplication({ initialPath: "/admin/categories/new", isAdmin: true });
    await heading("Create Service Category");
    await user.type(screen.getByRole("textbox", { name: /Service Category name/ }), "Graphics & Design");
    await user.click(screen.getByRole("button", { name: "Create Category" }));
    expect(await screen.findByText("A Service Category with this name already exists.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: /Service Category name/ })).toHaveFocus();
    expect(posts).toBe(0);
    duplicate.unmount();

    const app = renderTestApplication({ initialPath: "/admin/categories/new?page=2&pageSize=25", isAdmin: true });
    await heading("Create Service Category");
    await user.type(screen.getByRole("textbox", { name: /Service Category name/ }), "New Marketplace Category");
    await user.click(screen.getByRole("button", { name: "Create Category" }));
    await waitFor(() => expect(posts).toBe(1));
    await waitFor(() => expect(app.currentLocation()).toBe("/admin/categories?page=2&pageSize=25"));
    app.unmount();

    server.use(
      http.get(categoriesUrl, () => HttpResponse.json({ content: [categoryOne] })),
      http.post(categoriesUrl, () => HttpResponse.json({ message: "duplicate" }, { status: 400 })),
    );
    renderTestApplication({ initialPath: "/admin/categories/new", isAdmin: true });
    await heading("Create Service Category");
    await user.type(screen.getByRole("textbox", { name: /Service Category name/ }), "Server Rejects This");
    await user.click(screen.getByRole("button", { name: "Create Category" }));
    expect(await screen.findByText(/server rejected this Service Category name/i)).toBeVisible();
    expect(screen.getByRole("textbox", { name: /Service Category name/ })).toHaveAttribute("aria-invalid", "true");
  });

  it("edits a Category only after fresh target and hierarchy evidence", async () => {
    let puts = 0;
    server.use(http.put(categoryUrl("1"), async ({ request }) => {
      puts += 1;
      const body = await request.json() as { tenLoaiCongViec: string };
      return HttpResponse.json({ content: { id: 1, tenLoaiCongViec: body.tenLoaiCongViec } });
    }));
    const app = renderTestApplication({ initialPath: "/admin/categories/1/edit?page=1&pageSize=10", isAdmin: true });
    const user = userEvent.setup();
    const input = await screen.findByRole("textbox", { name: /Service Category name/ }, { timeout: 5_000 });
    await user.clear(input);
    await user.type(input, "Creative Design");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(puts).toBe(1));
    await waitFor(() => expect(app.currentLocation()).toBe("/admin/categories/1?page=1&pageSize=10"));
  });

  it("distinguishes not-found, forbidden, offline and relationship verification failures", async () => {
    server.use(http.get(categoryUrl("999"), () => HttpResponse.json({ message: "missing" }, { status: 404 })));
    const missing = renderTestApplication({ initialPath: "/admin/categories/999", isAdmin: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("Service Category not found");
    missing.unmount();

    server.use(http.get(pagingUrl, () => HttpResponse.json({ message: "forbidden" }, { status: 403 })));
    const forbidden = renderTestApplication({ initialPath: "/admin/categories", isAdmin: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("Access forbidden");
    forbidden.unmount();

    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    server.use(http.get(pagingUrl, () => HttpResponse.error()));
    const offline = renderTestApplication({ initialPath: "/admin/categories", isAdmin: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("You are offline");
    offline.unmount();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });

    server.use(http.get(hierarchyUrl("1"), () => HttpResponse.json({ content: "bad" })));
    renderTestApplication({ initialPath: "/admin/categories/1", isAdmin: true });
    await heading("Service Category Detail");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("data-state", "blocked-dependency");
    expect(alert).toHaveTextContent(/relationships could not be verified/);
  });

  it.each([375, 768, 1440])("keeps Category list, detail actions and forms available at %i px", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    window.dispatchEvent(new Event("resize"));
    const list = renderTestApplication({ initialPath: "/admin/categories", isAdmin: true });
    expect(await screen.findByRole("grid", { name: "Service Category list" })).toBeVisible();
    expect(screen.getByRole("link", { name: "View Graphics & Design" })).toBeVisible();
    list.unmount();

    const detail = renderTestApplication({ initialPath: "/admin/categories/1", isAdmin: true });
    await heading("Service Category Detail");
    expect(await screen.findByRole("navigation", { name: "Service Category detail actions" })).toBeVisible();
    detail.unmount();

    renderTestApplication({ initialPath: "/admin/categories/new", isAdmin: true });
    await heading("Create Service Category");
    expect(screen.getByRole("textbox", { name: /Service Category name/ })).toBeVisible();
  });
});
