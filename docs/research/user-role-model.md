# BC93 Fiverr user-role model

## Research question

Are `User`, `Client`, `Seller`, and `Administrator` distinct account types or contextual roles in the BC93 Fiverr project? What role values, authentication claims, and capabilities does the Cybersoft API actually expose?

Research was performed on 2026-08-11 against primary sources only: the repository's captured Swagger artifact, the live first-party Cybersoft Swagger/API, the Balsamiq wireframe, and the current source/domain documents. No API mutation was made.

## Conclusion

The model supported by the evidence is:

- **User** is the account and authenticated identity.
- **Client** is a contextual marketplace role: a User acts as a Client when discovering or hiring a Service.
- **Seller** is also contextual: a User acts as a Seller when they own/create a Service. Service ownership is represented by `CongViec.nguoiTao`; there is no canonical `SELLER` auth claim or seller-specific account schema.
- **Administrator** is a privileged User, represented by the canonical auth/account role `ADMIN`. It is not a separate identity schema.

Therefore, Client and Seller should not be modeled as mutually exclusive account types. One ordinary User can act in either or both contexts. The application-level authorization distinction should be `USER` versus `ADMIN`, while Client/Seller capabilities should be derived from the current action and resource ownership.

## Evidence

### Account and authentication representation

The User schema has one free-form string property named `role`; it does not define an enum or separate Client/Seller flags. The same is true of the update-user schema ([captured Swagger: `ThongTinNguoiDung`](../../swagger-API.json#L2711), [captured Swagger: `CapNhatNguoiDung`](../../swagger-API.json#L2883), [live Cybersoft Swagger JSON](https://fiverrnew.cybersoft.edu.vn/swagger/v1/swagger.json)).

The captured signup response creates a User whose role is `USER`. The captured signin response returns the User plus a JWT; its decoded payload contains only `id`, `email`, `role`, `nbf`, and `exp`, with `role: USER`. It has no Client or Seller claim ([signup example](../../swagger-API.json#L38), [signin example](../../swagger-API.json#L88)).

The wireframe's admin screen explicitly instructs the implementer to create/update an ordinary user with `role` changed to `ADMIN`. This describes Administrator as a role of the same User record, not another account type ([`trang admin / quản lý user` mockup](../../fiverr-wireframe.bmpr)). The captured API examples likewise show user records changing to `ADMIN` through the normal user update shape ([update-user example](../../swagger-API.json#L1934)).

The official Cybersoft project description distinguishes a user-facing UI and an Admin Dashboard, and says the API supports user classification. It does not specify distinct Client and Seller account schemas ([official Cybersoft course/project description](https://cybersoft.edu.vn/lap-trinh-back-end-nodejs-viet-api-thuc-te/)).

### Role values actually exposed

Canonical values evidenced by authentication and the admin requirement are:

- `USER`: returned by signup/signin and present in the JWT role claim.
- `ADMIN`: used by the admin wireframe and returned by captured user update/upload examples.

The API does **not** constrain `role` to these values in Swagger. A read-only call to the first-party [`GET /api/users`](https://fiverrnew.cybersoft.edu.vn/api/users) on 2026-08-11 returned 683 records with these exact stored strings:

| Stored role | Count |
|---|---:|
| `USER` | 611 |
| `ADMIN` | 65 |
| `admin` | 2 |
| `seller` | 1 |
| `Menter` | 1 |
| `testing` | 1 |
| `Free` | 1 |
| `string` | 1 |

This is evidence that the field accepts uncontrolled strings, not evidence that every observed string is a supported authorization role. In particular, the lone `seller` value cannot establish a Seller account type when the same dataset contains obvious arbitrary values and neither Swagger nor JWT examples define `SELLER`. Application code should treat `USER` and `ADMIN` as the only canonical values, compare them case-sensitively after controlled normalization at an API boundary, and treat all other values as invalid/unknown rather than silently granting capabilities.

### Contextual Client capability

Hiring is modeled by `ThueCongViec`, whose fields are `maCongViec`, `maNguoiThue`, `ngayThue`, and `hoanThanh`; there is no Client role field ([live Cybersoft Swagger JSON](https://fiverrnew.cybersoft.edu.vn/swagger/v1/swagger.json)). The endpoint `GET /api/thue-cong-viec/lay-danh-sach-da-thue` uses the user token to return the signed-in user's hired Services. A read-only request with only `tokenCybersoft` and no user JWT returned HTTP 403 on 2026-08-11, confirming that this capability is tied to authenticated identity, not a Client claim.

The project glossary already defines Client behaviorally as “a user who discovers and hires a service,” which matches the API representation ([CONTEXT.md](../../CONTEXT.md)).

### Contextual Seller capability

The Service (`CongViec`) schema stores its creator as the integer `nguoiTao`. The API exposes ordinary Service CRUD endpoints and has no seller profile schema, Seller auth claim, or seller-specific route group ([live Cybersoft Swagger JSON](https://fiverrnew.cybersoft.edu.vn/swagger/v1/swagger.json)). The Service-detail wireframe asks for “thông tin user tạo công việc,” again deriving seller context from the User who created the Service ([`trang chi tiết công việc` mockup](../../fiverr-wireframe.bmpr)).

The project glossary defines Seller behaviorally as “a user who offers a service,” which is compatible with resource ownership rather than a separate account type ([CONTEXT.md](../../CONTEXT.md)).

### Administrator capability and enforcement limits

The wireframe assigns Administrator the UI capabilities to manage Users, Services, and Service Categories ([`trang admin / quản lý user` mockup](../../fiverr-wireframe.bmpr)). The live API exposes CRUD endpoints for all three resource groups, so those management operations exist ([live Cybersoft Swagger JSON](https://fiverrnew.cybersoft.edu.vn/swagger/v1/swagger.json)).

However, the published Swagger does not declare `securityDefinitions`, role requirements, or per-operation authorization policies. Its user-token header is shown as an optional plain header on many mutations. A read-only call to `GET /api/users` with a Cybersoft project token but no user JWT returned HTTP 200, as did `GET /api/users/1` and `GET /api/thue-cong-viec`. Thus the documentation and safe observations do not prove that the backend enforces admin-only access for management endpoints.

The current frontend also has no role-aware authorization: `PrivateRoute` checks only whether a token exists, and login persists only the token ([PrivateRoute.tsx](../../src/components/PrivateRoute.tsx#L9), [Login.tsx](../../src/pages/Login.tsx#L14)). This is current implementation state, not a desired security model.

## Capability model supported for the specification

| Actor/context | Supported capability | Basis |
|---|---|---|
| Visitor | Browse/search Services, categories, details, and comments | Corresponding GET endpoints require only `tokenCybersoft` in Swagger. |
| Authenticated User acting as Client | Hire a Service; view their hired Services; complete/cancel a hired relationship where supported | Hire schema and token-scoped hired-list endpoint; no Client claim. |
| User acting as Seller | Be the creator/owner displayed for a Service | `CongViec.nguoiTao` ownership field; no Seller claim. |
| Administrator (`ADMIN`) | Access Admin UI for User, Service, and Service Category management | Wireframe plus matching CRUD APIs. Frontend must enforce route/UI checks; backend enforcement is unverified. |

## Uncertainties and required decisions

1. **Backend authorization is undocumented.** The API contract does not say which mutation requires `USER`, `ADMIN`, ownership, or merely a token. Mutation probing was intentionally not performed. The product spec must not claim server-enforced admin security without a controlled authorization test or provider confirmation.
2. **Service ownership enforcement is unknown.** `nguoiTao` exists, but Swagger does not state whether an ordinary authenticated User may create/update/delete only their own Services, or whether these endpoints are intended only for Admin.
3. **Comment ownership enforcement is unknown.** Comment update/delete accept a comment id and optional token header in Swagger, but no ownership rule is documented.
4. **Hire completion actor is unclear.** The completion endpoint does not declare a user-token header in Swagger, so it is unknown whether Client, Seller, Admin, or anyone with the id may complete it.
5. **`role` input is not validated as an enum.** The spec should define canonical application roles as `USER | ADMIN` and handle malformed legacy values safely.

## Recommended Wayfinder decision

Adopt this domain rule for the forthcoming spec:

> A User is the sole account identity. Client and Seller are contextual roles inferred from marketplace actions and resource ownership and may apply to the same User. Administrator is a privileged User whose canonical API role is `ADMIN`; ordinary accounts use `USER`. No other stored role string grants permissions.

Treat authorization enforcement as a separate API-contract decision ticket. Until verified, frontend guards provide UX/access control only and must not be described as a security boundary.
