import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const initialServiceDtos = Array.from({ length: 7 }, (_, index) => ({
  id: index + 1,
  tenCongViec: `Service ${index + 1}`,
  moTa: `Description ${index + 1}`,
  giaTien: (index + 1) * 10,
  hinhAnh: `https://images.example.test/service-${index + 1}.jpg`,
  saoCongViec: 5,
  nguoiTao: 100 + index,
}));

let serviceDtos = structuredClone(initialServiceDtos);

const encodeTokenPart = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

const validUserToken = `${encodeTokenPart({ alg: "none", typ: "JWT" })}.${encodeTokenPart({
  exp: 4_102_444_800,
})}.test-signature`;

export function resetTestData() {
  serviceDtos = structuredClone(initialServiceDtos);
}

export const handlers = [
  http.get("http://api.example.test/api/cong-viec/lay-menu-loai-cong-viec", () =>
    HttpResponse.json({
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
    }),
  ),
  http.get("http://api.example.test/api/cong-viec/lay-chi-tiet-loai-cong-viec/:categoryId", ({ params }) =>
    HttpResponse.json({
      content: String(params.categoryId) === "1" ? [
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
      ] : [],
    }),
  ),
  http.get("https://fiverrnew.cybersoft.edu.vn/api/cong-viec", () =>
    HttpResponse.json({ statusCode: 200, content: [] }),
  ),
  http.post("http://api.example.test/api/auth/signin", () =>
    HttpResponse.json({
      statusCode: 200,
      message: "Success",
      content: {
        user: {
          id: 700,
          name: "Alex Morgan",
          email: "alex@example.com",
          password: "must-not-cross-the-boundary",
          avatar: null,
          role: "USER",
        },
        token: validUserToken,
      },
    }),
  ),
  http.post("http://api.example.test/api/auth/signup", () =>
    HttpResponse.json({
      statusCode: 200,
      message: "Success",
      content: {
        id: 700,
        name: "Alex Morgan",
        email: "alex@example.com",
        password: "must-not-cross-the-boundary",
        phone: "+84901234567",
        role: "USER",
      },
    }),
  ),
  http.get("http://api.example.test/api/cong-viec", ({ request }) => {
    if (request.headers.get("tokenCybersoft") !== "deterministic-test-token") {
      return HttpResponse.json({ message: "Missing test token" }, { status: 401 });
    }

    return HttpResponse.json({
      statusCode: 200,
      message: "Success",
      content: serviceDtos,
      dateTime: "2026-08-12T00:00:00.000Z",
    });
  }),
  http.get(
    "http://api.example.test/api/cong-viec/lay-danh-sach-cong-viec-theo-ten/:search",
    () => HttpResponse.json({ content: [] }),
  ),
  http.get(
    "http://api.example.test/api/cong-viec/lay-cong-viec-theo-chi-tiet-loai/:subcategoryId",
    () => HttpResponse.json({ content: [] }),
  ),
];

export const server = setupServer(...handlers);
