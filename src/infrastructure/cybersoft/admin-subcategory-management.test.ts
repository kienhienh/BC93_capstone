import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../test/server";
import { createCybersoftAdminSubcategoryManagementCapability } from "./admin-subcategory-management";

const apiBaseUrl = "http://api.example.test/api";
const categoriesUrl = `${apiBaseUrl}/loai-cong-viec`;
const subcategoriesUrl = `${apiBaseUrl}/chi-tiet-loai-cong-viec`;
const pagingUrl = `${subcategoriesUrl}/phan-trang-tim-kiem`;
const subcategoryUrl = (id: string) => `${subcategoriesUrl}/${id}`;
const hierarchyUrl = (id: string) => `${apiBaseUrl}/cong-viec/lay-chi-tiet-loai-cong-viec/${id}`;
const themNhomUrl = `${subcategoriesUrl}/them-nhom-chi-tiet-loai`;
const suaNhomUrl = (id: string) => `${subcategoriesUrl}/sua-nhom-chi-tiet-loai/${id}`;

const subcategoryOne = { id: 100, tenChiTiet: "Logo Design" };
const subcategoryTwo = { id: 101, tenChiTiet: "Business Cards" };

const capability = () => createCybersoftAdminSubcategoryManagementCapability({ apiBaseUrl, cybersoftToken: "cybersoft-token" });

describe("Cybersoft Admin Service Subcategory Management adapter", () => {
  it("loads the complete Category and Subcategory snapshots with both auth headers", async () => {
    let headers: Headers | undefined;
    server.use(http.get(categoriesUrl, ({ request }) => {
      headers = request.headers;
      return HttpResponse.json({ content: [{ id: 1, tenLoaiCongViec: "Graphics & Design" }] });
    }));
    const result = await capability().listAllCategories("session-token");
    expect(result).toEqual([{ id: "1", name: "Graphics & Design" }]);
    expect(headers?.get("token")).toBe("session-token");
    expect(headers?.get("tokenCybersoft")).toBe("cybersoft-token");

    server.use(http.get(subcategoriesUrl, () => HttpResponse.json({ content: [subcategoryOne, subcategoryTwo] })));
    await expect(capability().listAllSubcategories("session-token")).resolves.toEqual([
      { id: "100", name: "Logo Design" },
      { id: "101", name: "Business Cards" },
    ]);
  });

  it("lists Subcategories with q-compatible paging parameters", async () => {
    let url: URL | undefined;
    server.use(http.get(pagingUrl, ({ request }) => {
      url = new URL(request.url);
      return HttpResponse.json({ content: { pageIndex: 2, pageSize: 25, totalRow: 30, keywords: "logo", data: [subcategoryOne] } });
    }));
    const result = await capability().listSubcategories({ pageIndex: 2, pageSize: 25, keyword: "logo" }, "session-token");
    expect(result.scope).toBe("server");
    expect(url?.searchParams.get("pageIndex")).toBe("2");
    expect(url?.searchParams.get("pageSize")).toBe("25");
    expect(url?.searchParams.get("keyword")).toBe("logo");
  });

  it("falls back to the complete Subcategory snapshot when paging is malformed", async () => {
    server.use(
      http.get(pagingUrl, () => HttpResponse.json({ content: "bad" })),
      http.get(subcategoriesUrl, () => HttpResponse.json({ content: [subcategoryOne, subcategoryTwo] })),
    );
    const result = await capability().listSubcategories({ pageIndex: 1, pageSize: 10, keyword: "business" }, "session-token");
    expect(result.scope).toBe("client-fallback");
    expect(result.data.map((item) => item.name)).toEqual(["Business Cards"]);
  });

  it("selects the requested Subcategory from the array-shaped detail response", async () => {
    server.use(http.get(subcategoryUrl("101"), () => HttpResponse.json({ content: [subcategoryOne, subcategoryTwo] })));
    await expect(capability().getSubcategoryById("101", "session-token")).resolves.toEqual({ id: "101", name: "Business Cards" });
  });

  it("maps Category hierarchy including the Category name without inventing Group or Subcategory levels", async () => {
    server.use(http.get(hierarchyUrl("1"), () => HttpResponse.json({ content: [{
      id: 1,
      tenLoaiCongViec: "Graphics & Design",
      dsNhomChiTietLoai: [
        { id: 10, tenNhom: "Logo & Brand Identity", hinhAnh: null, dsChiTietLoai: [subcategoryOne] },
        { id: 11, tenNhom: "Art", hinhAnh: null, dsChiTietLoai: [] },
      ],
    }] })));
    const hierarchy = await capability().getCategoryHierarchy("1", "session-token");
    expect(hierarchy.categoryName).toBe("Graphics & Design");
    expect(hierarchy.groups[0].subcategories[0]).toEqual({ id: "100", name: "Logo Design" });
    expect(hierarchy.groups[1].subcategories).toEqual([]);
  });

  it("creates, updates, and deletes only the Subcategory resource", async () => {
    const bodies: unknown[] = [];
    let deleteUrl: URL | undefined;
    server.use(
      http.post(subcategoriesUrl, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ content: { id: 102, tenChiTiet: "New Subcategory" } });
      }),
      http.put(subcategoryUrl("102"), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ content: { id: 102, tenChiTiet: "Renamed Subcategory" } });
      }),
      http.delete(subcategoryUrl("102"), ({ request }) => {
        deleteUrl = new URL(request.url);
        return HttpResponse.json({ content: null });
      }),
    );
    const api = capability();
    await expect(api.createSubcategory({ name: "New Subcategory" }, "session-token")).resolves.toMatchObject({ id: "102" });
    await expect(api.updateSubcategory("102", { name: "Renamed Subcategory" }, "session-token")).resolves.toMatchObject({ name: "Renamed Subcategory" });
    await api.deleteSubcategory("102", "session-token");
    expect(bodies).toEqual([{ tenChiTiet: "New Subcategory" }, { id: 102, tenChiTiet: "Renamed Subcategory" }]);
    expect(deleteUrl?.pathname).toBe("/api/chi-tiet-loai-cong-viec/102");
  });

  it("sends the Category and full member list when creating and editing a Service Group", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(themNhomUrl, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ content: null });
      }),
      http.put(suaNhomUrl("10"), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ content: null });
      }),
    );
    const api = capability();
    await api.createGroup({ name: "Logo & Brand Identity", categoryId: "1", subcategoryIds: ["100", "101"] }, "session-token");
    await api.updateGroup("10", { name: "Renamed Group", categoryId: "1", subcategoryIds: ["100"] }, "session-token");
    expect(bodies).toEqual([
      { tenChiTiet: "Logo & Brand Identity", maLoaiCongViec: 1, danhSachChiTiet: [100, 101] },
      { id: 10, tenChiTiet: "Renamed Group", maLoaiCongViec: 1, danhSachChiTiet: [100] },
    ]);
  });

  it("maps server name validation and ambiguous transport outcomes distinctly", async () => {
    server.use(http.post(subcategoriesUrl, () => HttpResponse.json({ message: "duplicate" }, { status: 400 })));
    await expect(capability().createSubcategory({ name: "Logo Design" }, "session-token")).rejects.toMatchObject({ kind: "validation" });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("socket reset")));
    await expect(capability().updateSubcategory("1", { name: "Changed" }, "session-token")).rejects.toMatchObject({ kind: "unknown_outcome" });
    await expect(capability().createGroup({ name: "X", categoryId: "1", subcategoryIds: [] }, "session-token")).rejects.toMatchObject({ kind: "unknown_outcome" });
    vi.unstubAllGlobals();
  });
});
