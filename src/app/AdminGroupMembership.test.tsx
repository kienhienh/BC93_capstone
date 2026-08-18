import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderTestApplication } from "../test/render-application";
import { server } from "../test/server";

const apiBaseUrl = "http://api.example.test/api";
const categoriesUrl = `${apiBaseUrl}/loai-cong-viec`;
const subcategoriesUrl = `${apiBaseUrl}/chi-tiet-loai-cong-viec`;
const subcategoryUrl = (id: string) => `${subcategoriesUrl}/${id}`;
const hierarchyUrl = (id: string) => `${apiBaseUrl}/cong-viec/lay-chi-tiet-loai-cong-viec/${id}`;
const themNhomUrl = `${subcategoriesUrl}/them-nhom-chi-tiet-loai`;
const suaNhomUrl = (id: string) => `${subcategoriesUrl}/sua-nhom-chi-tiet-loai/${id}`;

const categoryOne = { id: 1, tenLoaiCongViec: "Graphics & Design" };
const subcategoryOne = { id: 100, tenChiTiet: "Logo Design" };
const subcategoryTwo = { id: 101, tenChiTiet: "Business Cards" };

function hierarchyContent(groups: unknown[]) {
  return { content: [{ id: categoryOne.id, tenLoaiCongViec: categoryOne.tenLoaiCongViec, dsNhomChiTietLoai: groups }] };
}

function defaults(groups: unknown[] = []) {
  server.use(
    http.get(categoriesUrl, () => HttpResponse.json({ content: [categoryOne] })),
    http.get(`${categoriesUrl}/1`, () => HttpResponse.json({ content: [categoryOne] })),
    http.get(hierarchyUrl("1"), () => HttpResponse.json(hierarchyContent(groups))),
    http.get(subcategoriesUrl, () => HttpResponse.json({ content: [subcategoryOne, subcategoryTwo] })),
    http.get(subcategoryUrl("100"), () => HttpResponse.json({ content: [subcategoryOne] })),
    http.get(subcategoryUrl("101"), () => HttpResponse.json({ content: [subcategoryTwo] })),
  );
}

function defaultsWithMutableHierarchy(getGroups: () => unknown[]) {
  server.use(
    http.get(categoriesUrl, () => HttpResponse.json({ content: [categoryOne] })),
    http.get(`${categoriesUrl}/1`, () => HttpResponse.json({ content: [categoryOne] })),
    http.get(hierarchyUrl("1"), () => HttpResponse.json(hierarchyContent(getGroups()))),
    http.get(subcategoriesUrl, () => HttpResponse.json({ content: [subcategoryOne, subcategoryTwo] })),
    http.get(subcategoryUrl("100"), () => HttpResponse.json({ content: [subcategoryOne] })),
    http.get(subcategoryUrl("101"), () => HttpResponse.json({ content: [subcategoryTwo] })),
  );
}

describe("Administrator Service Group membership", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("adds a Service Group entry point from the Category Detail page", async () => {
    defaults([]);
    renderTestApplication({ initialPath: "/admin/categories/1", isAdmin: true });
    await screen.findByRole("heading", { name: "Service Category Detail" });
    expect(await screen.findByRole("link", { name: "Add Service Group" })).toHaveAttribute("href", "/admin/subcategories/groups/1/new");
  });

  it("creates a Service Group with initial membership after reviewing the change", async () => {
    let groups: unknown[] = [];
    defaultsWithMutableHierarchy(() => groups);
    let body: unknown;
    server.use(http.post(themNhomUrl, async ({ request }) => {
      body = await request.json();
      groups = [{ id: 10, tenNhom: "Logo & Brand Identity", hinhAnh: null, dsChiTietLoai: [subcategoryOne] }];
      return HttpResponse.json({ content: null });
    }));
    const app = renderTestApplication({ initialPath: "/admin/subcategories/groups/1/new", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Add Service Group" });
    await user.type(await screen.findByRole("textbox", { name: /Service Group name/ }), "Logo & Brand Identity");
    await user.click(screen.getByRole("checkbox", { name: "Logo Design" }));
    await user.click(screen.getByRole("button", { name: "Review Group" }));

    const dialog = screen.getByRole("dialog", { name: "Review Service Group membership?" });
    expect(within(dialog).getByText("Logo & Brand Identity")).toBeVisible();
    expect(within(dialog).getByText("Adding")).toBeVisible();
    expect(within(dialog).getByText("Logo Design")).toBeVisible();

    await user.click(within(dialog).getByRole("button", { name: "Confirm & save" }));

    await waitFor(() => expect(body).toEqual({ tenChiTiet: "Logo & Brand Identity", maLoaiCongViec: 1, danhSachChiTiet: [100] }));
    await waitFor(() => expect(app.currentLocation()).toBe("/admin/categories/1"));
  });

  it("edits a Service Group's membership and summarizes additions and removals for confirmation", async () => {
    let groups: unknown[] = [{ id: 10, tenNhom: "Logo & Brand Identity", hinhAnh: null, dsChiTietLoai: [subcategoryOne] }];
    defaultsWithMutableHierarchy(() => groups);
    let body: unknown;
    server.use(http.put(suaNhomUrl("10"), async ({ request }) => {
      body = await request.json();
      groups = [{ id: 10, tenNhom: "Logo & Brand Identity", hinhAnh: null, dsChiTietLoai: [subcategoryTwo] }];
      return HttpResponse.json({ content: null });
    }));
    const app = renderTestApplication({ initialPath: "/admin/subcategories/groups/1/10/edit", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Edit Service Group" });
    const nameInput = await screen.findByRole("textbox", { name: /Service Group name/ });
    expect(nameInput).toHaveValue("Logo & Brand Identity");
    expect(screen.getByRole("checkbox", { name: "Logo Design" })).toBeChecked();

    await user.click(screen.getByRole("checkbox", { name: "Logo Design" }));
    await user.click(screen.getByRole("checkbox", { name: "Business Cards" }));
    await user.click(screen.getByRole("button", { name: "Review changes" }));

    const dialog = screen.getByRole("dialog", { name: "Review Service Group membership?" });
    expect(within(dialog).getByText("Adding")).toBeVisible();
    expect(within(dialog).getAllByText("Business Cards")).not.toHaveLength(0);
    expect(within(dialog).getByText("Removing")).toBeVisible();

    await user.click(within(dialog).getByRole("button", { name: "Confirm & save" }));

    await waitFor(() => expect(body).toEqual({ id: 10, tenChiTiet: "Logo & Brand Identity", maLoaiCongViec: 1, danhSachChiTiet: [101] }));
    await waitFor(() => expect(app.currentLocation()).toBe("/admin/categories/1"));
  });

  it("blocks selecting a Subcategory already claimed by a different Service Group", async () => {
    defaults([
      { id: 10, tenNhom: "Logo & Brand Identity", hinhAnh: null, dsChiTietLoai: [subcategoryOne] },
      { id: 20, tenNhom: "Print Materials", hinhAnh: null, dsChiTietLoai: [subcategoryTwo] },
    ]);
    renderTestApplication({ initialPath: "/admin/subcategories/groups/1/10/edit", isAdmin: true });
    await screen.findByRole("heading", { name: "Edit Service Group" });
    const foreignCheckbox = await screen.findByRole("checkbox", { name: "Business Cards" });
    expect(foreignCheckbox).toBeDisabled();
    expect(screen.getByText(/Already in Service Group “Print Materials”/)).toBeVisible();
  });

  it("blocks stale Service Group data with Reload latest and no force path", async () => {
    defaults([{ id: 10, tenNhom: "Logo & Brand Identity", hinhAnh: null, dsChiTietLoai: [subcategoryOne] }]);
    let puts = 0;
    server.use(http.put(suaNhomUrl("10"), () => { puts += 1; return HttpResponse.json({ content: null }); }));
    renderTestApplication({ initialPath: "/admin/subcategories/groups/1/10/edit", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Edit Service Group" });
    await screen.findByRole("checkbox", { name: "Logo Design" });

    server.use(http.get(hierarchyUrl("1"), () => HttpResponse.json(hierarchyContent([
      { id: 10, tenNhom: "Renamed Elsewhere", hinhAnh: null, dsChiTietLoai: [subcategoryOne] },
    ]))));
    await user.click(screen.getByRole("button", { name: "Review changes" }));
    await user.click(screen.getByRole("dialog", { name: "Review Service Group membership?" }).querySelector("button.admin-primary-action") as HTMLButtonElement);

    const stale = await screen.findByRole("alert");
    expect(stale).toHaveAttribute("data-state", "stale");
    expect(within(stale).getByRole("button", { name: "Reload latest" })).toBeVisible();
    expect(puts).toBe(0);
  });

  it("reconciles an unknown Service Group update outcome without resubmitting the mutation", async () => {
    let groups: unknown[] = [{ id: 10, tenNhom: "Logo & Brand Identity", hinhAnh: null, dsChiTietLoai: [subcategoryOne] }];
    defaultsWithMutableHierarchy(() => groups);
    let puts = 0;
    server.use(http.put(suaNhomUrl("10"), () => {
      puts += 1;
      groups = [{ id: 10, tenNhom: "Logo & Brand Identity", hinhAnh: null, dsChiTietLoai: [subcategoryOne, subcategoryTwo] }];
      return HttpResponse.error();
    }));
    const app = renderTestApplication({ initialPath: "/admin/subcategories/groups/1/10/edit", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Edit Service Group" });
    await screen.findByRole("checkbox", { name: "Logo Design" });
    await user.click(screen.getByRole("checkbox", { name: "Business Cards" }));
    await user.click(screen.getByRole("button", { name: "Review changes" }));
    await user.click(screen.getByRole("dialog", { name: "Review Service Group membership?" }).querySelector("button.admin-primary-action") as HTMLButtonElement);

    await waitFor(() => expect(app.currentLocation()).toBe("/admin/categories/1"));
    expect(puts).toBe(1);
  });

  it("blocks deleting a Subcategory that is still a Service Group member", async () => {
    defaults([{ id: 10, tenNhom: "Logo & Brand Identity", hinhAnh: null, dsChiTietLoai: [subcategoryOne] }]);
    let deletes = 0;
    server.use(http.delete(subcategoryUrl("100"), () => { deletes += 1; return HttpResponse.json({ content: null }); }));
    renderTestApplication({ initialPath: "/admin/subcategories/100", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Service Subcategory Detail" });
    await user.click(await screen.findByRole("button", { name: "Delete Logo Design" }));
    const dialog = screen.getByRole("dialog", { name: "Delete Service Subcategory?" });
    await user.type(within(dialog).getByRole("textbox", { name: "Type Logo Design to confirm" }), "Logo Design");
    await user.click(within(dialog).getByRole("button", { name: "Delete Logo Design" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("data-state", "blocked-dependency");
    expect(alert).toHaveTextContent(/still a member of Service Group “Logo & Brand Identity”/);
    expect(deletes).toBe(0);
  });

  it.each([375, 768, 1440])("keeps the Service Group review dialog keyboard-safe at %i px", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    window.dispatchEvent(new Event("resize"));
    defaults([]);
    renderTestApplication({ initialPath: "/admin/subcategories/groups/1/new", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Add Service Group" });
    await user.type(await screen.findByRole("textbox", { name: /Service Group name/ }), "Logo & Brand Identity");
    await user.click(screen.getByRole("button", { name: "Review Group" }));
    const dialog = screen.getByRole("dialog", { name: "Review Service Group membership?" });
    const confirm = within(dialog).getByRole("button", { name: "Confirm & save" });
    expect(confirm).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("traps Tab focus within the Service Group review dialog", async () => {
    defaults([]);
    renderTestApplication({ initialPath: "/admin/subcategories/groups/1/new", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Add Service Group" });
    await user.type(await screen.findByRole("textbox", { name: /Service Group name/ }), "Logo & Brand Identity");
    await user.click(screen.getByRole("button", { name: "Review Group" }));
    const dialog = screen.getByRole("dialog", { name: "Review Service Group membership?" });
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    const confirm = within(dialog).getByRole("button", { name: "Confirm & save" });
    expect(confirm).toHaveFocus();

    await user.tab();
    expect(cancel).toHaveFocus();

    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
  });
});
