import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderTestApplication } from "../test/render-application";
import { server } from "../test/server";

const apiBaseUrl = "http://api.example.test/api";
const categoriesUrl = `${apiBaseUrl}/loai-cong-viec`;
const subcategoriesUrl = `${apiBaseUrl}/chi-tiet-loai-cong-viec`;
const pagingUrl = `${subcategoriesUrl}/phan-trang-tim-kiem`;
const subcategoryUrl = (id: string) => `${subcategoriesUrl}/${id}`;
const hierarchyUrl = (id: string) => `${apiBaseUrl}/cong-viec/lay-chi-tiet-loai-cong-viec/${id}`;

const categoryOne = { id: 1, tenLoaiCongViec: "Graphics & Design" };
const subcategoryOne = { id: 100, tenChiTiet: "Logo Design" };
const subcategoryTwo = { id: 101, tenChiTiet: "Business Cards" };

function paging(data = [subcategoryOne], totalRow = 60, pageIndex = 1, pageSize = 10, keywords: string | null = null) {
  return { content: { pageIndex, pageSize, totalRow, keywords, data } };
}

function emptyHierarchyFor(category: typeof categoryOne) {
  return { content: [{ id: category.id, tenLoaiCongViec: category.tenLoaiCongViec, dsNhomChiTietLoai: [] }] };
}

function installDefaultHandlers() {
  server.use(
    http.get(pagingUrl, ({ request }) => {
      const url = new URL(request.url);
      return HttpResponse.json(paging(
        [subcategoryOne],
        60,
        Number(url.searchParams.get("pageIndex") ?? 1),
        Number(url.searchParams.get("pageSize") ?? 10),
        url.searchParams.get("keyword"),
      ));
    }),
    http.get(subcategoriesUrl, () => HttpResponse.json({ content: [subcategoryOne, subcategoryTwo] })),
    http.get(subcategoryUrl("100"), () => HttpResponse.json({ content: [subcategoryOne] })),
    http.get(subcategoryUrl("101"), () => HttpResponse.json({ content: [subcategoryTwo] })),
    http.get(categoriesUrl, () => HttpResponse.json({ content: [categoryOne] })),
    http.get(hierarchyUrl("1"), () => HttpResponse.json(emptyHierarchyFor(categoryOne))),
  );
}

async function heading(name: string) {
  return screen.findByRole("heading", { name }, { timeout: 5_000 });
}

describe("Administrator Service Subcategory Management", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    installDefaultHandlers();
  });

  it("turns Service Subcategories into a real Admin destination and preserves q/page/pageSize through routes", async () => {
    const query = "?q=logo&page=2&pageSize=25";
    const app = renderTestApplication({ initialPath: `/admin/subcategories${query}`, isAdmin: true });
    const grid = await screen.findByRole("grid", { name: "Service Subcategory list" }, { timeout: 5_000 });
    expect(app.currentLocation()).toBe(`/admin/subcategories${query}`);
    expect(within(grid).getByRole("link", { name: "View Logo Design" })).toHaveAttribute("href", `/admin/subcategories/100${query}`);
    expect(within(grid).getByRole("link", { name: "Edit Logo Design" })).toHaveAttribute("href", `/admin/subcategories/100/edit${query}`);
    expect(screen.getByRole("link", { name: /Create Subcategory/ })).toHaveAttribute("href", `/admin/subcategories/new${query}`);
    app.unmount();

    const detail = renderTestApplication({ initialPath: `/admin/subcategories/100${query}`, isAdmin: true });
    await heading("Service Subcategory Detail");
    expect(await screen.findByRole("link", { name: "Back to list" })).toHaveAttribute("href", `/admin/subcategories${query}`);
    expect(screen.getByRole("link", { name: "Edit Subcategory" })).toHaveAttribute("href", `/admin/subcategories/100/edit${query}`);
    detail.unmount();

    renderTestApplication({ initialPath: `/admin/subcategories/100/edit${query}`, isAdmin: true });
    await heading("Edit Service Subcategory");
    expect(await screen.findByRole("link", { name: "Cancel" })).toHaveAttribute("href", `/admin/subcategories${query}`);
  });

  it("normalizes URL state, searches, paginates and distinguishes empty from query-empty", async () => {
    const app = renderTestApplication({ initialPath: "/admin/subcategories?page=bad&pageSize=999", isAdmin: true });
    await screen.findByRole("grid", { name: "Service Subcategory list" });
    await waitFor(() => expect(app.currentLocation()).toBe("/admin/subcategories?page=1&pageSize=10"));
    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox", { name: "Search Service Subcategories by name" }), "missing");
    server.use(http.get(pagingUrl, () => HttpResponse.json(paging([], 0, 1, 10, "missing"))));
    await user.click(screen.getByRole("button", { name: "Refresh Subcategories" }));
    expect(await screen.findByText(/No Service Subcategories match your search/)).toHaveAttribute("data-state", "query-empty");
    app.unmount();

    server.use(http.get(pagingUrl, () => HttpResponse.json(paging([], 0))));
    renderTestApplication({ initialPath: "/admin/subcategories", isAdmin: true });
    expect(await screen.findByText("No Service Subcategories found.")).toHaveAttribute("data-state", "empty");
  });

  it("creates a unique Subcategory and attaches duplicate or server validation feedback to the name field", async () => {
    let posts = 0;
    server.use(http.post(subcategoriesUrl, async ({ request }) => {
      posts += 1;
      const body = await request.json() as { tenChiTiet: string };
      return HttpResponse.json({ content: { id: 102, tenChiTiet: body.tenChiTiet } });
    }));
    const user = userEvent.setup();
    const duplicate = renderTestApplication({ initialPath: "/admin/subcategories/new", isAdmin: true });
    await heading("Create Service Subcategory");
    await user.type(screen.getByRole("textbox", { name: /Service Subcategory name/ }), "Logo Design");
    await user.click(screen.getByRole("button", { name: "Create Subcategory" }));
    expect(await screen.findByText("A Service Subcategory with this name already exists.")).toBeVisible();
    expect(posts).toBe(0);
    duplicate.unmount();

    const app = renderTestApplication({ initialPath: "/admin/subcategories/new?page=2&pageSize=25", isAdmin: true });
    await heading("Create Service Subcategory");
    await user.type(screen.getByRole("textbox", { name: /Service Subcategory name/ }), "Brand Guidelines");
    await user.click(screen.getByRole("button", { name: "Create Subcategory" }));
    await waitFor(() => expect(posts).toBe(1));
    await waitFor(() => expect(app.currentLocation()).toBe("/admin/subcategories?page=2&pageSize=25"));
    app.unmount();

    server.use(http.post(subcategoriesUrl, () => HttpResponse.json({ message: "duplicate" }, { status: 400 })));
    renderTestApplication({ initialPath: "/admin/subcategories/new", isAdmin: true });
    await heading("Create Service Subcategory");
    await user.type(screen.getByRole("textbox", { name: /Service Subcategory name/ }), "Server Rejects This");
    await user.click(screen.getByRole("button", { name: "Create Subcategory" }));
    expect(await screen.findByText(/server rejected this Service Subcategory name/i)).toBeVisible();
    expect(screen.getByRole("textbox", { name: /Service Subcategory name/ })).toHaveAttribute("aria-invalid", "true");
  });

  it("edits a Subcategory only after fresh target evidence", async () => {
    let puts = 0;
    server.use(http.put(subcategoryUrl("100"), async ({ request }) => {
      puts += 1;
      const body = await request.json() as { tenChiTiet: string };
      return HttpResponse.json({ content: { id: 100, tenChiTiet: body.tenChiTiet } });
    }));
    const app = renderTestApplication({ initialPath: "/admin/subcategories/100/edit?page=1&pageSize=10", isAdmin: true });
    const user = userEvent.setup();
    const input = await screen.findByRole("textbox", { name: /Service Subcategory name/ }, { timeout: 5_000 });
    await user.clear(input);
    await user.type(input, "Logo Redesign");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(puts).toBe(1));
    await waitFor(() => expect(app.currentLocation()).toBe("/admin/subcategories/100?page=1&pageSize=10"));
  });

  it("shows current Service Group membership on the Subcategory detail page", async () => {
    server.use(http.get(hierarchyUrl("1"), () => HttpResponse.json({ content: [{
      id: 1,
      tenLoaiCongViec: "Graphics & Design",
      dsNhomChiTietLoai: [{ id: 10, tenNhom: "Logo & Brand Identity", hinhAnh: null, dsChiTietLoai: [subcategoryOne] }],
    }] })));
    const member = renderTestApplication({ initialPath: "/admin/subcategories/100", isAdmin: true });
    await heading("Service Subcategory Detail");
    expect(await screen.findByText(/Member of Service Group “Logo & Brand Identity” under Service Category “Graphics & Design”/)).toBeVisible();
    member.unmount();

    renderTestApplication({ initialPath: "/admin/subcategories/101", isAdmin: true });
    await heading("Service Subcategory Detail");
    expect(await screen.findByText("Not currently assigned to any Service Group.")).toBeVisible();
  });

  it("distinguishes not-found, forbidden and offline failures", async () => {
    server.use(http.get(subcategoryUrl("999"), () => HttpResponse.json({ message: "missing" }, { status: 404 })));
    const missing = renderTestApplication({ initialPath: "/admin/subcategories/999", isAdmin: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("Not found.");
    missing.unmount();

    server.use(http.get(pagingUrl, () => HttpResponse.json({ message: "forbidden" }, { status: 403 })));
    const forbidden = renderTestApplication({ initialPath: "/admin/subcategories", isAdmin: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("Access forbidden");
    forbidden.unmount();

    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    server.use(http.get(pagingUrl, () => HttpResponse.error()));
    renderTestApplication({ initialPath: "/admin/subcategories", isAdmin: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("You are offline");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it.each([375, 768, 1440])("keeps Subcategory list, detail actions and forms available at %i px", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    window.dispatchEvent(new Event("resize"));
    const list = renderTestApplication({ initialPath: "/admin/subcategories", isAdmin: true });
    expect(await screen.findByRole("grid", { name: "Service Subcategory list" })).toBeVisible();
    expect(screen.getByRole("link", { name: "View Logo Design" })).toBeVisible();
    list.unmount();

    const detail = renderTestApplication({ initialPath: "/admin/subcategories/100", isAdmin: true });
    await heading("Service Subcategory Detail");
    expect(await screen.findByRole("navigation", { name: "Service Subcategory detail actions" })).toBeVisible();
    detail.unmount();

    renderTestApplication({ initialPath: "/admin/subcategories/new", isAdmin: true });
    await heading("Create Service Subcategory");
    expect(screen.getByRole("textbox", { name: /Service Subcategory name/ })).toBeVisible();
  });
});
