import { test as base, expect, type Page, type Route } from "@playwright/test";

export const API_ORIGIN = "https://cybersoft.example";
export const SESSION_STORAGE_KEY = "fiverr-marketplace-session";

const encodeTokenPart = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

export function makeToken(expiresAtSeconds: number) {
  return `${encodeTokenPart({ alg: "none", typ: "JWT" })}.${encodeTokenPart({
    exp: expiresAtSeconds,
  })}.e2e-signature`;
}

export const regularUser = {
  id: 700,
  name: "Alex Morgan",
  email: "alex@example.com",
  phone: "+84901234567",
  birthday: "1995-04-18",
  avatar: null as string | null,
  gender: true,
  role: "USER",
  skill: [] as string[],
  certification: [] as string[],
};

export const adminUser = {
  id: 900,
  name: "Admin User",
  email: "admin@example.com",
  phone: "+84900000000",
  birthday: "1990-01-01",
  avatar: null as string | null,
  gender: true,
  role: "ADMIN",
  skill: [] as string[],
  certification: [] as string[],
};

const farFutureExpiry = 4_102_444_800; // 2100-01-01

export async function seedSession(page: Page, user: typeof regularUser | typeof adminUser) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [
      SESSION_STORAGE_KEY,
      JSON.stringify({
        token: makeToken(farFutureExpiry),
        user: {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
      }),
    ],
  );
}

export const service = {
  id: 1,
  tenCongViec: "Modern Logo Design",
  moTa: "A clean, modern logo package for growing businesses.",
  moTaNgan: "Modern logo package",
  giaTien: 50,
  hinhAnh: "https://images.example.test/service-1.jpg",
  saoCongViec: 5,
  nguoiTao: 800,
};

const menuPayload = {
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
};

const comment = {
  id: 901,
  ngayBinhLuan: "2026-08-14T04:30:00.000Z",
  noiDung: "Delivered exactly what I needed.",
  saoBinhLuan: 5,
  tenNguoiBinhLuan: regularUser.name,
  maCongViec: service.id,
};

type Handler = (route: Route) => Promise<void> | void;

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

/**
 * Ordered [method, pathname RegExp, handler] table. Playwright resolves
 * multiple matching `page.route` registrations last-registered-first, so
 * per-test `mockApi.use(...)` overrides installed after these defaults win.
 */
function defaultRoutes(state: {
  hiredServices: Array<{ id: number; congViec: typeof service; ngayThue: string; hoanThanh: boolean }>;
  comments: Array<typeof comment>;
}): Array<[string, RegExp, Handler]> {
  return [
    ["GET", /\/cong-viec\/lay-menu-loai-cong-viec$/, (route) => json(route, menuPayload)],
    ["GET", /\/cong-viec\/lay-chi-tiet-loai-cong-viec\/\d+$/, (route) => json(route, menuPayload)],
    ["GET", /\/cong-viec\/lay-cong-viec-theo-chi-tiet-loai\/\d+$/, (route) =>
      json(route, { content: [service] })],
    ["GET", /\/cong-viec\/lay-danh-sach-cong-viec-theo-ten\/.+$/, (route) =>
      json(route, { content: [service] })],
    ["GET", /\/cong-viec\/lay-cong-viec-chi-tiet\/\d+$/, (route) =>
      json(route, {
        content: [{
          id: service.id,
          congViec: service,
          tenLoaiCongViec: "Graphics & Design",
          tenNhomChiTietLoai: "Logo & Brand Identity",
          tenChiTietLoai: "Logo Design",
          tenNguoiTao: "Sam Seller",
          avatar: null,
          email: "sam@example.com",
          phone: "+84900000001",
        }],
      })],
    ["GET", /\/cong-viec$/, (route) => json(route, { content: [service] })],
    ["GET", /\/binh-luan\/lay-binh-luan-theo-cong-viec\/\d+$/, (route) =>
      json(route, { content: state.comments })],
    ["GET", /\/binh-luan$/, (route) => json(route, { content: state.comments })],
    ["POST", /\/binh-luan$/, async (route) => {
      const body = route.request().postDataJSON() as {
        maCongViec?: number;
        maNguoiBinhLuan?: number;
        ngayBinhLuan?: string;
        noiDung?: string;
        saoBinhLuan?: number;
      };
      return json(route, {
        content: {
          id: 999,
          maCongViec: body.maCongViec ?? service.id,
          maNguoiBinhLuan: body.maNguoiBinhLuan ?? adminUser.id,
          ngayBinhLuan: body.ngayBinhLuan ?? new Date().toISOString(),
          noiDung: body.noiDung ?? "",
          saoBinhLuan: body.saoBinhLuan ?? 5,
        },
      }, 201);
    }],
    ["POST", /\/auth\/signin$/, (route) => json(route, {
      statusCode: 200,
      message: "Success",
      content: { user: { ...regularUser, password: "must-not-cross-the-boundary" }, token: makeToken(farFutureExpiry) },
    })],
    ["POST", /\/auth\/signup$/, (route) => json(route, {
      statusCode: 200,
      message: "Success",
      content: { ...regularUser, password: "must-not-cross-the-boundary" },
    })],
    ["GET", /\/users\/\d+$/, (route) => json(route, { content: regularUser })],
    ["GET", /\/users$/, (route) => json(route, { content: [regularUser, adminUser] })],
    ["PUT", /\/users\/\d+$/, (route) => json(route, { content: regularUser })],
    ["POST", /\/thue-cong-viec$/, (route) => {
      const id = 500 + state.hiredServices.length;
      state.hiredServices.push({ id, congViec: service, ngayThue: new Date().toISOString(), hoanThanh: false });
      return json(route, { content: { id } }, 201);
    }],
    ["GET", /\/thue-cong-viec\/lay-danh-sach-da-thue$/, (route) =>
      json(route, { content: state.hiredServices })],
    ["PUT", /\/thue-cong-viec\/\d+$/, (route) => {
      const id = Number(new URL(route.request().url()).pathname.split("/").pop());
      const item = state.hiredServices.find((x) => x.id === id);
      if (item) item.hoanThanh = true;
      return route.fulfill({ status: 200, body: "" });
    }],
    ["DELETE", /\/thue-cong-viec\/\d+$/, (route) => {
      const id = Number(new URL(route.request().url()).pathname.split("/").pop());
      state.hiredServices = state.hiredServices.filter((x) => x.id !== id);
      return route.fulfill({ status: 200, body: "" });
    }],
  ];
}

export type MockApi = {
  use(method: string, pattern: RegExp, handler: Handler): void;
  hiredServices: Array<{ id: number; congViec: typeof service; ngayThue: string; hoanThanh: boolean }>;
  comments: Array<typeof comment>;
  unmatched: string[];
};

async function installMockApi(page: Page): Promise<MockApi> {
  const state = {
    hiredServices: [] as Array<{ id: number; congViec: typeof service; ngayThue: string; hoanThanh: boolean }>,
    comments: [comment],
  };
  const unmatched: string[] = [];
  const overrides: Array<[string, RegExp, Handler]> = [];

  await page.route(`${API_ORIGIN}/api/**`, async (route) => {
    const request = route.request();
    const method = request.method();
    const pathname = new URL(request.url()).pathname;
    const table = [...overrides].reverse().concat(defaultRoutes(state));
    const match = table.find(([m, pattern]) => m === method && pattern.test(pathname));
    if (!match) {
      unmatched.push(`${method} ${pathname}`);
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Unmocked request in e2e run" }) });
      return;
    }
    await match[2](route);
  });

  return {
    use(method, pattern, handler) {
      overrides.push([method, pattern, handler]);
    },
    get hiredServices() { return state.hiredServices; },
    set hiredServices(value) { state.hiredServices = value; },
    get comments() { return state.comments; },
    set comments(value) { state.comments = value; },
    unmatched,
  };
}

export const test = base.extend<{ mockApi: MockApi }>({
  mockApi: [async ({ page }, use) => {
    const mockApi = await installMockApi(page);
    await use(mockApi);
    expect(mockApi.unmatched, "unmocked Cybersoft requests during this test").toEqual([]);
  }, { auto: true }],
});

export { expect };
