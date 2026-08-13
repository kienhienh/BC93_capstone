import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test/server";
import { createCybersoftTaxonomyCapability } from "./taxonomy";

const taxonomyUrl = "http://api.example.test/api/cong-viec/lay-menu-loai-cong-viec";

function createCapability() {
  return createCybersoftTaxonomyCapability({
    apiBaseUrl: "http://api.example.test/api",
    cybersoftToken: "deterministic-test-token",
  });
}

describe("Cybersoft taxonomy boundary", () => {
  it("maps the API hierarchy without turning Groups into selectable leaves", async () => {
    server.use(
      http.get(
        taxonomyUrl,
        ({ request }) => {
          expect(request.headers.get("tokenCybersoft")).toBe("deterministic-test-token");
          return HttpResponse.json({
            content: [
              {
                id: 1,
                tenLoaiCongViec: "Graphics & Design",
                dsNhomChiTietLoai: [
                  {
                    id: 10,
                    tenNhom: "Logo & Brand Identity",
                    hinhAnh: "https://images.example.test/logo.jpg",
                    maLoaiCongviec: 1,
                    dsChiTietLoai: [{ id: 100, tenChiTiet: "Logo Design" }],
                  },
                ],
              },
            ],
          });
        },
      ),
    );
    const capability = createCapability();

    await expect(capability.listCategories(new AbortController().signal)).resolves.toEqual([
      {
        id: "1",
        name: "Graphics & Design",
        groups: [
          {
            id: "10",
            name: "Logo & Brand Identity",
            imageUrl: "https://images.example.test/logo.jpg",
            subcategories: [{ id: "100", name: "Logo Design" }],
          },
        ],
      },
    ]);
  });

  it("rejects malformed hierarchy data at the HTTP boundary", async () => {
    server.use(http.get(taxonomyUrl, () => HttpResponse.json({ content: [{ id: 1 }] })));

    await expect(createCapability().listCategories(new AbortController().signal)).rejects.toEqual(
      expect.objectContaining({ kind: "malformed" }),
    );
  });

  it("maps a server response to a safe server failure", async () => {
    server.use(http.get(taxonomyUrl, () => new HttpResponse(null, { status: 503 })));

    await expect(createCapability().listCategories(new AbortController().signal)).rejects.toEqual(
      expect.objectContaining({ kind: "server" }),
    );
  });
});
