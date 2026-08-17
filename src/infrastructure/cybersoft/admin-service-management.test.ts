import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "../../test/server";
import { createCybersoftAdminServiceManagementCapability } from "./admin-service-management";

const apiBaseUrl = "http://api.example.test/api";
const servicesUrl = `${apiBaseUrl}/cong-viec`;
const listUrl = `${apiBaseUrl}/cong-viec/phan-trang-tim-kiem`;
const getServiceUrl = (id: string) => `${apiBaseUrl}/cong-viec/${id}`;
const searchServiceUrl = (name: string) => `${apiBaseUrl}/cong-viec/lay-danh-sach-cong-viec-theo-ten/${name}`;
const uploadImageUrl = (id: string) => `${apiBaseUrl}/cong-viec/upload-hinh-cong-viec/${id}`;
const hiresUrl = `${apiBaseUrl}/thue-cong-viec`;

const serviceDto = {
  id: 1,
  tenCongViec: "I will design a modern logo",
  moTa: "Full description",
  moTaNgan: "Short description",
  giaTien: 25,
  hinhAnh: "https://images.example.test/service-1.jpg",
  saoCongViec: 4,
  danhGia: 12,
  nguoiTao: 100,
  maChiTietLoaiCongViec: 5,
};

const capability = () =>
  createCybersoftAdminServiceManagementCapability({
    apiBaseUrl,
    cybersoftToken: "cybersoft-token",
  });

const baseUpdateInput = {
  title: "Updated title",
  description: "Full description",
  shortDescription: "Short description",
  price: 25,
  sellerId: "100",
  subcategoryId: "5",
  rating: 4,
  reviewCount: 12,
};

describe("Cybersoft Admin Service Management adapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads the complete Service resource snapshot", async () => {
    let headers: Headers | undefined;
    server.use(
      http.get(servicesUrl, ({ request }) => {
        headers = request.headers;
        return HttpResponse.json({ content: [serviceDto, { ...serviceDto, id: 2 }] });
      }),
    );

    const result = await capability().listAllServices("session-token");

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("I will design a modern logo");
    expect(headers?.get("token")).toBe("session-token");
    expect(headers?.get("tokenCybersoft")).toBe("cybersoft-token");
  });

  it("maps Vietnamese DTO fields to canonical domain fields, splitting rating from review count", async () => {
    server.use(http.get(servicesUrl, () => HttpResponse.json({ content: [serviceDto] })));

    const [service] = await capability().listAllServices("session-token");

    expect(service).toMatchObject({
      id: "1",
      title: "I will design a modern logo",
      description: "Full description",
      shortDescription: "Short description",
      price: 25,
      imageUrl: "https://images.example.test/service-1.jpg",
      rating: 4,
      reviewCount: 12,
      sellerId: "100",
      subcategoryId: "5",
    });
  });

  it("tolerates a record missing join-only fields instead of failing the whole list", async () => {
    server.use(http.get(servicesUrl, () => HttpResponse.json({ content: [serviceDto] })));

    const [service] = await capability().listAllServices("session-token");

    expect(service.sellerName).toBeNull();
    expect(service.categoryName).toBeNull();
    expect(service.groupName).toBeNull();
    expect(service.subcategoryName).toBeNull();
  });

  it("clamps an out-of-range legacy rating instead of rejecting the record", async () => {
    server.use(
      http.get(servicesUrl, () => HttpResponse.json({ content: [{ ...serviceDto, saoCongViec: 9 }] })),
    );

    const [service] = await capability().listAllServices("session-token");

    expect(service.rating).toBe(5);
  });

  it("searches services by name via the API endpoint", async () => {
    let requestedUrl = "";
    server.use(
      http.get(searchServiceUrl("logo%20design"), ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json({ content: [{ ...serviceDto, tenNguoiTao: "Alex Seller" }] });
      }),
    );

    const result = await capability().searchServicesByName("logo design", "session-token");

    expect(result).toHaveLength(1);
    expect(result[0].sellerName).toBe("Alex Seller");
    expect(decodeURIComponent(requestedUrl)).toContain("/cong-viec/lay-danh-sach-cong-viec-theo-ten/logo design");
  });

  it("lists services with pagination parameters", async () => {
    let url: URL | undefined;
    server.use(
      http.get(listUrl, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json({
          content: { pageIndex: 1, pageSize: 10, totalRow: 30, keywords: null, data: [serviceDto] },
        });
      }),
    );

    const result = await capability().listServices({ pageIndex: 1, pageSize: 10 }, "session-token");

    expect(result.pageIndex).toBe(1);
    expect(result.totalRow).toBe(30);
    expect(result.scope).toBe("server");
    expect(url?.searchParams.get("pageIndex")).toBe("1");
    expect(url?.searchParams.get("pageSize")).toBe("10");
  });

  it("falls back truthfully to the complete Service snapshot when pagination shape is unusable", async () => {
    server.use(
      http.get(listUrl, () => HttpResponse.json({ content: "bad-paging-shape" })),
      http.get(servicesUrl, () => HttpResponse.json({
        content: [serviceDto, { ...serviceDto, id: 2, tenCongViec: "Fast landing page build" }],
      })),
    );

    const result = await capability().listServices(
      { pageIndex: 1, pageSize: 10, keyword: "landing" },
      "session-token",
    );

    expect(result.scope).toBe("client-fallback");
    expect(result.totalRow).toBe(1);
    expect(result.data.map((service) => service.title)).toEqual(["Fast landing page build"]);
  });

  it("unwraps the array-wrapped detail response and returns the first record", async () => {
    server.use(http.get(getServiceUrl("1"), () => HttpResponse.json({ content: [serviceDto] })));

    const service = await capability().getServiceById("1", "session-token");

    expect(service.id).toBe("1");
  });

  it("treats an empty detail array as not found", async () => {
    server.use(http.get(getServiceUrl("999"), () => HttpResponse.json({ content: [] })));

    await expect(
      capability().getServiceById("999", "session-token"),
    ).rejects.toMatchObject({ kind: "not_found" });
  });

  it("always sends review count zero on create, regardless of caller input", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(servicesUrl, async ({ request }) => {
        body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ content: { ...serviceDto, id: 200, danhGia: 0 } });
      }),
    );

    const created = await capability().createService(
      {
        title: "New Service",
        description: "Desc",
        shortDescription: "Short",
        price: 40,
        sellerId: "100",
        subcategoryId: "5",
        rating: 0,
      },
      "session-token",
    );

    expect(created.reviewCount).toBe(0);
    expect(body).toMatchObject({ tenCongViec: "New Service", nguoiTao: 100, maChiTietLoaiCongViec: 5, danhGia: 0 });
  });

  it("updates a service and passes the caller-supplied review count through unchanged", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.put(getServiceUrl("1"), async ({ request }) => {
        body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ content: { ...serviceDto, tenCongViec: "Updated title" } });
      }),
    );

    const updated = await capability().updateService("1", baseUpdateInput, "session-token");

    expect(updated.title).toBe("Updated title");
    expect(body).toMatchObject({ id: 1, tenCongViec: "Updated title", nguoiTao: 100, maChiTietLoaiCongViec: 5, danhGia: 12 });
  });

  it("deletes a service using a path parameter, not a query string", async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.delete(getServiceUrl("1"), ({ request }) => {
        requestUrl = new URL(request.url);
        return HttpResponse.json({ content: null });
      }),
    );

    await capability().deleteService("1", "session-token");

    expect(requestUrl?.pathname).toBe("/api/cong-viec/1");
    expect(requestUrl?.searchParams.get("id")).toBeNull();
  });

  it("uploads a service image as multipart form data and returns the full updated record", async () => {
    let target: RequestInfo | URL | undefined;
    let options: RequestInit | undefined;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      target = input;
      options = init;
      return new Response(
        JSON.stringify({ content: { ...serviceDto, hinhAnh: "https://images.example.test/new.jpg" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }));
    const file = new File(["fake-image-bytes"], "logo.png", { type: "image/png" });

    const updated = await capability().uploadServiceImage("1", file, "session-token");

    expect(target).toBe(uploadImageUrl("1"));
    expect(options?.method).toBe("POST");
    expect(options?.headers).toMatchObject({ token: "session-token", tokenCybersoft: "cybersoft-token" });
    expect(options?.headers).not.toHaveProperty("Content-Type");
    expect((options?.body as FormData).get("formFile")).toBeInstanceOf(File);
    expect(updated.imageUrl).toBe("https://images.example.test/new.jpg");
  });

  it("proves hires for a service by filtering the global hire list client-side", async () => {
    server.use(
      http.get(hiresUrl, () => HttpResponse.json({
        content: [
          { id: 1, maCongViec: 9, maNguoiThue: 2, ngayThue: "1/1/2026", hoanThanh: false },
          { id: 2, maCongViec: 1, maNguoiThue: 3, ngayThue: "1/1/2026", hoanThanh: true },
        ],
      })),
    );

    await expect(capability().hasHiresForService("1", "session-token")).resolves.toBe(true);
    await expect(capability().hasHiresForService("42", "session-token")).resolves.toBe(false);
  });

  it("throws rather than assuming no hires when the dependency check itself fails", async () => {
    server.use(http.get(hiresUrl, () => HttpResponse.error()));

    await expect(
      capability().hasHiresForService("1", "session-token"),
    ).rejects.toMatchObject({ kind: "unknown_outcome" });
  });

  it("handles authorization errors correctly", async () => {
    server.use(http.get(listUrl, () => HttpResponse.json({ message: "Unauthorized" }, { status: 401 })));

    await expect(
      capability().listServices({ pageIndex: 1, pageSize: 10 }, "expired-token"),
    ).rejects.toMatchObject({ kind: "unauthorized" });
  });

  it("handles not found errors on detail", async () => {
    server.use(http.get(getServiceUrl("999"), () => HttpResponse.json({ message: "Not found" }, { status: 404 })));

    await expect(
      capability().getServiceById("999", "session-token"),
    ).rejects.toMatchObject({ kind: "not_found" });
  });

  it("reports malformed only when both pagination and the full Service fallback are unusable", async () => {
    server.use(
      http.get(listUrl, () => HttpResponse.json({ invalid: "response" })),
      http.get(servicesUrl, () => HttpResponse.json({ invalid: "response" })),
    );

    await expect(
      capability().listServices({ pageIndex: 1, pageSize: 10 }, "session-token"),
    ).rejects.toMatchObject({ kind: "malformed" });
  });

  it("classifies online transport failures during update/delete/upload as unknown outcomes", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    server.use(
      http.put(getServiceUrl("1"), () => HttpResponse.error()),
      http.delete(getServiceUrl("1"), () => HttpResponse.error()),
      http.post(uploadImageUrl("1"), () => HttpResponse.error()),
    );

    await expect(
      capability().updateService("1", { ...baseUpdateInput, title: "Maybe Updated" }, "session-token"),
    ).rejects.toMatchObject({ kind: "unknown_outcome" });
    await expect(
      capability().deleteService("1", "session-token"),
    ).rejects.toMatchObject({ kind: "unknown_outcome" });
    await expect(
      capability().uploadServiceImage("1", new File(["x"], "a.png", { type: "image/png" }), "session-token"),
    ).rejects.toMatchObject({ kind: "unknown_outcome" });
  });

  it("keeps an explicitly offline mutation distinct from an unknown outcome", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    server.use(http.put(getServiceUrl("1"), () => HttpResponse.error()));

    await expect(
      capability().updateService("1", { ...baseUpdateInput, title: "Offline" }, "session-token"),
    ).rejects.toMatchObject({ kind: "offline" });
  });
});
