import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { ServiceDetailFailure } from "../../features/service-detail/capability";
import { server } from "../../test/server";
import { createCybersoftServiceDetailCapability } from "./service-detail";

const apiBaseUrl = "http://api.example.test/api";

function createCapability() {
  return createCybersoftServiceDetailCapability({
    apiBaseUrl,
    cybersoftToken: "private-test-token",
  });
}

describe("Cybersoft Service Detail capability", () => {
  it("validates and maps a privacy-safe Seller summary while sending the API token", async () => {
    let receivedToken: string | null = null;
    server.use(
      http.get(`${apiBaseUrl}/cong-viec/lay-cong-viec-chi-tiet/42`, ({ request }) => {
        receivedToken = request.headers.get("tokenCybersoft");
        return HttpResponse.json({
          content: [{
            congViec: {
              id: 42,
              tenCongViec: "Validated Service",
              giaTien: 120,
              moTa: "Validated description",
              nguoiTao: 7,
            },
            tenNguoiTao: "Safe Seller",
            avatar: "https://images.example.test/seller.jpg",
            email: "must-not-escape@example.test",
            phone: "+84900000000",
          }],
        });
      }),
    );

    const service = await createCapability().getService("42", new AbortController().signal);

    expect(receivedToken).toBe("private-test-token");
    expect(service.seller).toEqual({
      id: "7",
      name: "Safe Seller",
      avatarUrl: "https://images.example.test/seller.jpg",
    });
    expect(service.seller).not.toHaveProperty("email");
    expect(service.seller).not.toHaveProperty("phone");
  });

  it("rejects malformed Service and Comments payloads at the adapter boundary", async () => {
    server.use(
      http.get(`${apiBaseUrl}/cong-viec/lay-cong-viec-chi-tiet/42`, () =>
        HttpResponse.json({ content: [{ unexpected: true }] }),
      ),
      http.get(`${apiBaseUrl}/binh-luan/lay-binh-luan-theo-cong-viec/42`, () =>
        HttpResponse.json({ content: "unsafe" }),
      ),
    );
    const capability = createCapability();

    await expect(capability.getService("42", new AbortController().signal)).rejects.toMatchObject({
      kind: "malformed",
    } satisfies Partial<ServiceDetailFailure>);
    await expect(capability.listComments("42", new AbortController().signal)).rejects.toMatchObject({
      kind: "malformed",
    } satisfies Partial<ServiceDetailFailure>);
  });

  it("normalizes empty optional API strings to neutral fallbacks", async () => {
    server.use(
      http.get(`${apiBaseUrl}/cong-viec/lay-cong-viec-chi-tiet/42`, () =>
        HttpResponse.json({
          content: [{
            congViec: {
              id: 42,
              tenCongViec: "Service with empty optional fields",
              giaTien: 45,
              moTa: "Valid canonical content",
              nguoiTao: 7,
              hinhAnh: "",
              moTaNgan: "",
            },
            tenNguoiTao: "Seller",
            avatar: "",
          }],
        }),
      ),
    );

    await expect(createCapability().getService("42", new AbortController().signal)).resolves.toMatchObject({
      imageUrl: null,
      shortDescription: null,
      seller: { name: "Seller", avatarUrl: null },
    });
  });

  it("keeps valid Comment content when its optional rating is outside the supported range", async () => {
    server.use(
      http.get(`${apiBaseUrl}/binh-luan/lay-binh-luan-theo-cong-viec/42`, () =>
        HttpResponse.json({
          content: [{
            id: 9,
            ngayBinhLuan: "2026-08-14T01:00:00.000Z",
            noiDung: "Useful content",
            saoBinhLuan: 9,
            tenNguoiBinhLuan: "Reader",
            avatar: "",
          }],
        }),
      ),
    );

    await expect(createCapability().listComments("42", new AbortController().signal)).resolves.toEqual([
      expect.objectContaining({ content: "Useful content", rating: null, avatarUrl: null }),
    ]);
  });
});
