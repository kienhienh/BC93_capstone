# Cybersoft Fiverr API contract for BC93

## Research question

What contract is authoritative for the approved BC93 Fiverr scope: base URL, required endpoints and schemas, authentication headers, safely verifiable authorization/ownership behavior, snapshot discrepancies, and shared-backend constraints?

Research was performed on 2026-08-11 using primary sources only: the live official Swagger and read-only API calls, the provided `swagger-API.json`, the Balsamiq wireframe, and repository source. No create, update, upload, completion, or delete request was sent.

## Decision summary

1. The authority is the [live Cybersoft Swagger UI](https://fiverrnew.cybersoft.edu.vn/swagger/index.html) and [Swagger JSON](https://fiverrnew.cybersoft.edu.vn/swagger/v1/swagger.json). The frontend base URL is `https://fiverrnew.cybersoft.edu.vn/api`.
2. The provided [`swagger-API.json`](../../swagger-API.json) is incomplete: 14 paths/20 operations versus 34 paths/51 operations live. The live operation set is a strict superset, adding 31 operations and nine request definitions with no local-only operation.
3. Every request needs `tokenCybersoft`. Authenticated operations additionally use the raw User JWT in `token` (not `Authorization: Bearer`). Swagger marks `token` optional and declares no `securityDefinitions`, so authorization cannot be inferred from it alone.
4. Successful reads use `{ statusCode, content, dateTime }`. Swagger publishes no response schemas, so read DTOs must be isolated behind adapters and contract fixtures.
5. The API is shared. Automated tests must not mutate it; manual writes are limited to uniquely namespaced project-owned records whose ids and cleanup are tracked.
6. User reads returned a `password` property. The frontend must discard it at the API boundary and never display, persist, log, or copy it into an update.

## Authority and transport

The official UI loads `/swagger/v1/swagger.json` from its own origin and all routes begin `/api`; it publishes no `host`, `basePath`, or `schemes`. Together these establish the HTTPS base URL above ([official Swagger](https://fiverrnew.cybersoft.edu.vn/swagger/v1/swagger.json)). The current client uses that same URL ([`src/services/api.ts`](../../src/services/api.ts)).

A safe preflight from a representative Vercel origin returned HTTP 204, reflected the origin, allowed credentials, and allowed `tokencybersoft,token`; a read-only GET returned HTTP 200. This establishes current CORS compatibility, not a versioned guarantee.

`tokenCybersoft` is sent by browser code, so a client-only deployment cannot keep it confidential. Environment configuration remains necessary for rotation and avoiding source hard-coding. The current client hard-codes it ([`src/services/api.ts`](../../src/services/api.ts)).

## Authentication and authorization

| Layer | Header | Safely observed behavior |
|---|---|---|
| Cybersoft project | `tokenCybersoft: <project-token>` | Required on all 51 operations; `GET /cong-viec` without it returned 403. |
| Signed-in User | `token: <user-jwt>` | Plain header on many mutations and hired-list; hired-list without it returned 403. |

Sign-in returns the User plus `content.token`, as consumed by current code ([local snapshot](../../swagger-API.json), [`Login.tsx`](../../src/pages/Login.tsx)). Signup/signin need only `tokenCybersoft` ([live Swagger](https://fiverrnew.cybersoft.edu.vn/swagger/v1/swagger.json)).

Published authorization is incomplete:

- User create/update/delete do not declare `token`.
- Service, Comment, Service Subcategory, upload, and most Hire mutations declare `token` but mark it optional.
- Hire completion does not declare `token`.
- User and global Hire pagination succeeded with only `tokenCybersoft`; the current User's hired list required `token`.

This does not prove unauthorized mutation is allowed; none was attempted. It proves the contract cannot support claims of server-enforced Administrator or ownership checks. Frontend guards are UX/access control only. The role model is covered by [`user-role-model.md`](./user-role-model.md).

## Observed read DTOs

```ts
type ApiSuccess<T> = { statusCode: number; content: T; dateTime: string };

type Service = {
  id: number; tenCongViec: string; danhGia: number; giaTien: number;
  nguoiTao: number; hinhAnh: string; moTa: string;
  maChiTietLoaiCongViec: number; moTaNgan: string; saoCongViec: number;
};

type ServiceSummary = {
  id: number; congViec: Service; tenLoaiCongViec: string;
  tenNhomChiTietLoai: string; tenChiTietLoai: string;
  tenNguoiTao: string; avatar: string;
};

type ServiceMenu = {
  id: number; tenLoaiCongViec: string;
  dsNhomChiTietLoai: Array<{
    id: number; tenNhom: string; hinhAnh: string; maLoaiCongviec: number;
    dsChiTietLoai: Array<{ id: number; tenChiTiet: string }>;
  }>;
};

type ServiceComment = {
  id: number; ngayBinhLuan: string; noiDung: string;
  saoBinhLuan: number; tenNguoiBinhLuan: string; avatar: string;
};

type Page<T> = {
  pageIndex: number; pageSize: number; totalRow: number;
  keywords: string | null; data: T[];
};
```

The raw Service list returns `Service[]`; detail, name search, and subcategory filtering return `ServiceSummary[]`. Detail is still an array and must handle zero/multiple entries. Category/Subcategory management reads return `Page<T>`. These are read-only observations because Swagger declares no response DTOs ([live Swagger](https://fiverrnew.cybersoft.edu.vn/swagger/v1/swagger.json)).

User pagination returned `id`, `name`, `email`, `password`, `phone`, `birthday`, `avatar`, `gender`, `role`, `skill`, `certification`, and `bookingJob`. A safe frontend User DTO must omit `password` and every unneeded field.

## Required endpoints

All paths below are relative to the API base and require `tokenCybersoft`. They are required by the confirmed wireframe or Administrator scope ([wireframe](../../fiverr-wireframe.bmpr), [live Swagger](https://fiverrnew.cybersoft.edu.vn/swagger/v1/swagger.json)).

### Visitor and authentication

| Method and path | Purpose | User `token` |
|---|---|---|
| `POST /auth/signup` | Register User | No |
| `POST /auth/signin` | Authenticate, receive User + JWT | No |
| `GET /cong-viec/lay-menu-loai-cong-viec` | Header category menu | No |
| `GET /cong-viec/lay-chi-tiet-loai-cong-viec/{MaLoaiCongViec}` | Category landing data | No |
| `GET /cong-viec/lay-cong-viec-theo-chi-tiet-loai/{MaChiTietLoai}` | Subcategory filter | No |
| `GET /cong-viec/lay-danh-sach-cong-viec-theo-ten/{TenCongViec}` | Name search | No |
| `GET /cong-viec/lay-cong-viec-chi-tiet/{MaCongViec}` | Composite Service detail | No |
| `GET /binh-luan/lay-binh-luan-theo-cong-viec/{MaCongViec}` | Service comments | No |
| `POST /binh-luan` | Add Comment | Declared optional; app requires sign-in |

### Profile and Hire

| Method and path | Purpose | User `token` |
|---|---|---|
| `GET /users/{id}` | User profile | Not declared |
| `PUT /users/{id}` | Update profile | Not declared |
| `POST /users/upload-avatar` | Update signed-in User avatar | Declared optional |
| `POST /thue-cong-viec` | Hire Service | Declared optional; app requires sign-in |
| `GET /thue-cong-viec/lay-danh-sach-da-thue` | Current User's Hired Services | Observed required |
| `POST /thue-cong-viec/hoan-thanh-cong-viec/{MaThueCongViec}` | Complete Hire | Not declared; actor unknown |
| `DELETE /thue-cong-viec/{id}` | Cancel/delete Hire | Declared optional; actor unknown |

### Administrator: Users and Services

| Resource | Required operations |
|---|---|
| Users | `GET /users/phan-trang-tim-kiem?pageIndex=&pageSize=&keyword=`, `GET /users/{id}`, `GET /users/search/{TenNguoiDung}`, `POST /users`, `PUT /users/{id}`, `DELETE /users?id=` |
| Services | `GET /cong-viec/phan-trang-tim-kiem?pageIndex=&pageSize=&keyword=`, `GET /cong-viec/{id}`, `POST /cong-viec`, `PUT /cong-viec/{id}`, `DELETE /cong-viec/{id}`, `POST /cong-viec/upload-hinh-cong-viec/{MaCongViec}` |

### Administrator: Service Categories and Service Subcategories

| Resource | Required operations |
|---|---|
| Service Categories | `GET /loai-cong-viec/phan-trang-tim-kiem?pageIndex=&pageSize=&keyword=`, `GET /loai-cong-viec/{id}`, `POST /loai-cong-viec`, `PUT /loai-cong-viec/{id}`, `DELETE /loai-cong-viec/{id}` |
| Service Subcategories | `GET /chi-tiet-loai-cong-viec/phan-trang-tim-kiem?pageIndex=&pageSize=&keyword=`, `GET /chi-tiet-loai-cong-viec/{id}`, `POST /chi-tiet-loai-cong-viec`, `PUT /chi-tiet-loai-cong-viec/{id}`, `DELETE /chi-tiet-loai-cong-viec/{id}`, `POST /chi-tiet-loai-cong-viec/them-nhom-chi-tiet-loai`, `PUT /chi-tiet-loai-cong-viec/sua-nhom-chi-tiet-loai/{id}`, `POST /chi-tiet-loai-cong-viec/upload-hinh-nhom-loai-cong-viec/{MaNhomLoaiCongViec}` |

Live also exposes global lists, Comment/Hire CRUD, `GET /skill`, and non-paginated lists. They are available but not required unless a later journey decision adds them.

## Published request schemas

Swagger defines no required-property arrays and marks every body parameter optional. The application must decide and validate required fields while preserving these names/types.

| Definition | Fields |
|---|---|
| `ThongTinNguoiDung` | `id: int`, `name: string`, `email: string`, `password: string`, `phone: string`, `birthday: string`, `gender: boolean`, `role: string`, `skill: string[]`, `certification: string[]` |
| `DangNhapView` | `email: string`, `password: string` |
| `CapNhatNguoiDung` | `id`, `name`, `email`, `phone`, `birthday`, `gender`, `role`, `skill`, `certification` (same types; no password) |
| `CongViecViewModel` | `id: int`, `tenCongViec: string`, `danhGia: int`, `giaTien: int`, `nguoiTao: int`, `hinhAnh: string`, `moTa: string`, `maChiTietLoaiCongViec: int`, `moTaNgan: string`, `saoCongViec: int` |
| `BinhLuanViewModel` | `id: int`, `maCongViec: int`, `maNguoiBinhLuan: int`, `ngayBinhLuan: string`, `noiDung: string`, `saoBinhLuan: int` |
| `ThueCongViecViewModel` | `id: int`, `maCongViec: int`, `maNguoiThue: int`, `ngayThue: string`, `hoanThanh: boolean` |
| `LoaiCongViecViewModel` | `id: int`, `tenLoaiCongViec: string` |
| `ChiTietLoaiView` | `id: int`, `tenChiTiet: string` |
| `ChiTietLoaiCongViecViewModel` | `id: int`, `tenChiTiet: string`, `maLoaiCongViec: int`, `danhSachChiTiet: int[]` |

Uploads use multipart field `formFile`; ids are in the route. Signup confirmation password is client-only and must not be sent. `role` has no API enum; canonical values and unknown-value handling belong to the authorization decision.

## Snapshot and code discrepancies

The local snapshot omits all nine definitions and 31 live operations: all Service update/delete/upload and five discovery-specific operations, every Service Category operation, every User operation, every Hire operation, and `GET /skill`. Neither snapshot nor live Swagger provides response schemas. Code generation from either without explicit adapters and observed-contract tests is unsafe.

The current frontend already calls live endpoints beyond the snapshot, but hard-codes `tokenCybersoft`, does not attach User `token` centrally, and persists only the JWT ([`src/services/api.ts`](../../src/services/api.ts), [`Login.tsx`](../../src/pages/Login.tsx)). Those are implementation gaps for later tickets, not contract changes.

## Safe shared-backend policy

1. Unit, integration, and end-to-end tests use API virtualization/fixtures and never write to live.
2. Read-only smoke tests may use approved GETs with rate limits and must not log full User payloads.
3. Manual writes require a dedicated project-owned User and names such as `BC93_CAPSTONE_<timestamp>_<purpose>`.
4. Record each created id and creator before follow-up. Update/upload/complete/delete only recorded ids.
5. Never promote, modify, or delete an unknown User or resource; never upload to an unknown id.
6. Cleanup is explicit and best-effort. Report failures; never broaden cleanup queries or infer ownership from name alone.
7. Never test destructive negative authorization cases on the shared backend. Provider confirmation or an isolated backend is required.

## Facts handed to subsequent decisions

- Discovery, detail, Comment, Profile, Hire, and all four confirmed Administrator management areas have matching live endpoints.
- Request schemas are published, but response/error schemas are not; adapters and observed-contract fixtures are mandatory.
- Administrator and ownership enforcement remain unresolved without controlled mutation or provider evidence.
- The test-data lifecycle is now a precise decision: dedicated User, namespace, id ledger, cleanup owner, and the manual/automated boundary must be chosen before any live write verification.

## Primary sources

- [Official Cybersoft Fiverr Swagger UI](https://fiverrnew.cybersoft.edu.vn/swagger/index.html)
- [Official Cybersoft Fiverr Swagger JSON](https://fiverrnew.cybersoft.edu.vn/swagger/v1/swagger.json)
- [Provided Swagger snapshot](../../swagger-API.json)
- [Provided Balsamiq wireframe](../../fiverr-wireframe.bmpr)
- [Current API client](../../src/services/api.ts)
- [Current routing](../../src/App.tsx)
- [Current login flow](../../src/pages/Login.tsx)
- [Canonical domain glossary](../../CONTEXT.md)
