import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test/server";
import { createCybersoftServiceDiscoveryCapability } from "./service-discovery";

const apiBaseUrl = "http://api.example.test/api";

describe("Cybersoft Service discovery boundary", () => {
  it("loads the complete collection with neutral seller fallbacks", async () => {
    const capability = createCybersoftServiceDiscoveryCapability({
      apiBaseUrl,
      cybersoftToken: "deterministic-test-token",
    });

    const services = await capability.listServices(new AbortController().signal);

    expect(services[0]).toMatchObject({
      id: "1",
      title: "Service 1",
      commentCount: 0,
      sellerName: null,
      sellerAvatarUrl: null,
    });
  });

  it("loads a subcategory through the dedicated API", async () => {
    server.use(
      http.get(
        apiBaseUrl + "/cong-viec/lay-cong-viec-theo-chi-tiet-loai/100",
        () => HttpResponse.json({ content: [] }),
      ),
    );
    const capability = createCybersoftServiceDiscoveryCapability({
      apiBaseUrl,
      cybersoftToken: "deterministic-test-token",
    });

    await expect(
      capability.listServicesBySubcategory("100", new AbortController().signal),
    ).resolves.toEqual([]);
  });

  it("loads a submitted Home search through the search capability without Seller N+1", async () => {
    let userRequests = 0;
    server.use(
      http.get(
        apiBaseUrl + "/cong-viec/lay-danh-sach-cong-viec-theo-ten/mobile%20app",
        () =>
          HttpResponse.json({
            content: [
              {
                id: 501,
                congViec: {
                  id: 41,
                  tenCongViec: "Build a mobile app",
                  danhGia: 27,
                  giaTien: 80,
                  nguoiTao: 9,
                  hinhAnh: "https://images.example.test/mobile-app.jpg",
                  moTa: "A production mobile application",
                  saoCongViec: 4.8,
                },
                tenNguoiTao: "Alex Seller",
                avatar: "https://images.example.test/alex.jpg",
              },
            ],
          }),
      ),
      http.get(apiBaseUrl + "/users/:id", () => {
        userRequests += 1;
        return HttpResponse.json({ content: {} });
      }),
    );
    const capability = createCybersoftServiceDiscoveryCapability({
      apiBaseUrl,
      cybersoftToken: "deterministic-test-token",
    });

    await expect(
      capability.searchServices("mobile app", new AbortController().signal),
    ).resolves.toEqual([
      {
        id: "41",
        title: "Build a mobile app",
        description: "A production mobile application",
        price: 80,
        imageUrl: "https://images.example.test/mobile-app.jpg",
        rating: 4.8,
        commentCount: 27,
        sellerName: "Alex Seller",
        sellerAvatarUrl: "https://images.example.test/alex.jpg",
      },
    ]);
    expect(userRequests).toBe(0);
  });

  it("rejects malformed discovery responses safely", async () => {
    server.use(
      http.get(apiBaseUrl + "/cong-viec/lay-danh-sach-cong-viec-theo-ten/broken", () =>
        HttpResponse.json({ content: "not-a-collection" }),
      ),
    );
    const capability = createCybersoftServiceDiscoveryCapability({ apiBaseUrl, cybersoftToken: "deterministic-test-token" });

    await expect(capability.searchServices("broken", new AbortController().signal)).rejects.toMatchObject({ kind: "malformed" });
  });

  it("distinguishes offline transport failures", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    server.use(http.get(apiBaseUrl + "/cong-viec/lay-danh-sach-cong-viec-theo-ten/offline", () => HttpResponse.error()));
    const capability = createCybersoftServiceDiscoveryCapability({ apiBaseUrl, cybersoftToken: "deterministic-test-token" });

    await expect(capability.searchServices("offline", new AbortController().signal)).rejects.toMatchObject({ kind: "offline" });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });
});
