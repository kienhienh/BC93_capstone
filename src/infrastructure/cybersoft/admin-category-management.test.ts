import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../test/server";
import { createCybersoftAdminCategoryManagementCapability } from "./admin-category-management";

const apiBaseUrl = "http://api.example.test/api";
const categoriesUrl = `${apiBaseUrl}/loai-cong-viec`;
const pagingUrl = `${categoriesUrl}/phan-trang-tim-kiem`;
const categoryUrl = (id: string) => `${categoriesUrl}/${id}`;
const hierarchyUrl = (id: string) => `${apiBaseUrl}/cong-viec/lay-chi-tiet-loai-cong-viec/${id}`;
const categoryOne = { id: 1, tenLoaiCongViec: "Graphics & Design" };
const categoryTwo = { id: 2, tenLoaiCongViec: "Digital Marketing" };

const capability = () => createCybersoftAdminCategoryManagementCapability({ apiBaseUrl, cybersoftToken: "cybersoft-token" });

describe("Cybersoft Admin Service Category Management adapter", () => {
  it("loads the complete Category snapshot with both auth headers", async () => {
    let headers: Headers | undefined;
    server.use(http.get(categoriesUrl, ({ request }) => {
      headers = request.headers;
      return HttpResponse.json({ content: [categoryOne, categoryTwo] });
    }));
    const result = await capability().listAllCategories("session-token");
    expect(result.map((item) => item.name)).toEqual(["Graphics & Design", "Digital Marketing"]);
    expect(headers?.get("token")).toBe("session-token");
    expect(headers?.get("tokenCybersoft")).toBe("cybersoft-token");
  });

  it("lists Categories with q-compatible paging parameters", async () => {
    let url: URL | undefined;
    server.use(http.get(pagingUrl, ({ request }) => {
      url = new URL(request.url);
      return HttpResponse.json({ content: { pageIndex: 2, pageSize: 25, totalRow: 30, keywords: "design", data: [categoryOne] } });
    }));
    const result = await capability().listCategories({ pageIndex: 2, pageSize: 25, keyword: "design" }, "session-token");
    expect(result.scope).toBe("server");
    expect(url?.searchParams.get("pageIndex")).toBe("2");
    expect(url?.searchParams.get("pageSize")).toBe("25");
    expect(url?.searchParams.get("keyword")).toBe("design");
  });

  it("falls back to the complete Category snapshot when paging is malformed", async () => {
    server.use(
      http.get(pagingUrl, () => HttpResponse.json({ content: "bad" })),
      http.get(categoriesUrl, () => HttpResponse.json({ content: [categoryOne, categoryTwo] })),
    );
    const result = await capability().listCategories({ pageIndex: 1, pageSize: 10, keyword: "digital" }, "session-token");
    expect(result.scope).toBe("client-fallback");
    expect(result.data.map((item) => item.name)).toEqual(["Digital Marketing"]);
  });

  it("selects the requested Category from the array-shaped detail response", async () => {
    server.use(http.get(categoryUrl("2"), () => HttpResponse.json({ content: [categoryOne, categoryTwo] })));
    await expect(capability().getCategoryById("2", "session-token")).resolves.toEqual({ id: "2", name: "Digital Marketing" });
  });

  it("maps Category hierarchy without inventing Group or Subcategory levels", async () => {
    server.use(http.get(hierarchyUrl("1"), () => HttpResponse.json({ content: [{
      id: 1,
      tenLoaiCongViec: "Graphics & Design",
      dsNhomChiTietLoai: [
        { id: 10, tenNhom: "Logo & Brand Identity", hinhAnh: null, dsChiTietLoai: [{ id: 100, tenChiTiet: "Logo Design" }] },
        { id: 11, tenNhom: "Art", hinhAnh: null, dsChiTietLoai: [] },
      ],
    }] })));
    const hierarchy = await capability().getCategoryHierarchy("1", "session-token");
    expect(hierarchy.groups[0].subcategories[0].name).toBe("Logo Design");
    expect(hierarchy.groups[1].subcategories).toEqual([]);
  });

  it("treats a valid empty hierarchy response as proven no reported dependencies", async () => {
    server.use(http.get(hierarchyUrl("9"), () => HttpResponse.json({ content: [] })));
    await expect(capability().getCategoryHierarchy("9", "session-token")).resolves.toEqual({ categoryId: "9", groups: [] });
  });

  it("creates, updates, and deletes only the Category resource", async () => {
    const bodies: unknown[] = [];
    let deleteUrl: URL | undefined;
    server.use(
      http.post(categoriesUrl, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ content: { id: 3, tenLoaiCongViec: "New Category" } });
      }),
      http.put(categoryUrl("3"), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ content: { id: 3, tenLoaiCongViec: "Renamed Category" } });
      }),
      http.delete(categoryUrl("3"), ({ request }) => {
        deleteUrl = new URL(request.url);
        return HttpResponse.json({ content: null });
      }),
    );
    const api = capability();
    await expect(api.createCategory({ name: "New Category" }, "session-token")).resolves.toMatchObject({ id: "3" });
    await expect(api.updateCategory("3", { name: "Renamed Category" }, "session-token")).resolves.toMatchObject({ name: "Renamed Category" });
    await api.deleteCategory("3", "session-token");
    expect(bodies).toEqual([{ tenLoaiCongViec: "New Category" }, { id: 3, tenLoaiCongViec: "Renamed Category" }]);
    expect(deleteUrl?.pathname).toBe("/api/loai-cong-viec/3");
  });

  it("maps server name validation and ambiguous transport outcomes distinctly", async () => {
    server.use(http.post(categoriesUrl, () => HttpResponse.json({ message: "duplicate" }, { status: 400 })));
    await expect(capability().createCategory({ name: "Graphics & Design" }, "session-token")).rejects.toMatchObject({ kind: "validation" });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("socket reset")));
    await expect(capability().updateCategory("1", { name: "Changed" }, "session-token")).rejects.toMatchObject({ kind: "unknown_outcome" });
    vi.unstubAllGlobals();
  });
});
