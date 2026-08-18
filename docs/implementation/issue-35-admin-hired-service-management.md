# Issue #35 — Administrator Hired Service Management

This implementation lets an Administrator inspect every Hired Service and
intentionally Complete or Cancel eligible Active engagements, without
creating a Hire for another User or rewriting engagement identity and date.

## Contract findings (verified against the live API, read-only)

A safe, read-only probe of the live Cybersoft API found:

- `GET /thue-cong-viec` (list all) returns the raw `ThueCongViecViewModel`
  shape only (`id`, `maCongViec`, `maNguoiThue`, `ngayThue`, `hoanThanh`) —
  no denormalized Client, Service, or Seller name, so those are joined in
  the browser the same way Comment joins Service/author.
- `GET /thue-cong-viec/phan-trang-tim-kiem` — the declared search/paging
  endpoint — pages correctly with no `keyword`, but **500s whenever
  `keyword` is non-empty** (`Invalid column name 'TenCongViec'`: the server
  tries to filter on a column that does not exist on the underlying join).
  It is therefore never used; `keyword` search stays entirely client-side,
  matching the Comment precedent.
- `GET /thue-cong-viec/{id}` does not exist (404); only `PUT`/`DELETE` are
  declared at that path. There is no way to read a single Hired Service by
  id, so fresh evidence for one record is obtained by re-reading the
  complete snapshot (`GET /thue-cong-viec`) and finding the match, the same
  approach Comment would have needed had its per-Service read not existed.
- `PUT /thue-cong-viec/{id} { hoanThanh: true }` and
  `DELETE /thue-cong-viec/{id}` are the same verbs the Client-facing
  capability (issue #27) already uses for Complete/Cancel and are reused
  unchanged, rather than adopting the separately declared but unverified
  `POST /thue-cong-viec/hoan-thanh-cong-viec/{id}` endpoint.
- `GET /cong-viec` echoes `nguoiTao` (the Service's creator/seller id)
  alongside `tenCongViec`/`giaTien`, so Seller identity and current price
  come from the same Service lookup already used elsewhere in this project.

## Design consequences

- **No server-side search is ever attempted.** The list route fetches the
  complete Hired Service snapshot once, then filters and paginates entirely
  client-side, with a permanent, truthful disclosure banner
  (`AdminHiredServiceListResult.scope` is always `"client-fallback"`).
- **A separate Active/Completed status filter is explicitly current-page
  only.** Because there is no working server-side status filter to re-query
  against, applying it would either be a no-op on `totalRow` or would
  silently misrepresent how many records match. `filterCurrentPageByStatus`
  trims only the rows already on the loaded page, and the UI carries a
  permanent disclosure saying so — it never changes the pagination math.
- **Single-record evidence re-reads the complete snapshot.** There is no
  cheaper scoped read (unlike Comment's per-Service comment list), so
  `refetchHiredServiceEvidence` calls the same `GET /thue-cong-viec` again
  and finds the match by id, returning `null` when the record is gone.
- **Client and Seller names are looked up separately and non-blockingly.**
  `listAllServices` (which also carries `sellerId` and current `price`) and
  `listAllUsers` are fetched once and joined by id in the browser. If either
  fails while Hired Services loaded fine, the list/detail still renders —
  falling back to `Service #<id>` / `User #<id>` — behind a non-blocking
  `partial-relation-failure` banner.
- **Current price is never presented as the amount paid.** The detail view
  labels it "Current price" with an explicit note that it reflects the
  Service today, not necessarily what was paid at hire time — no historical
  price is retained by the API.

## No Administrator-created Hire, no rewrite

- There is no create or edit route. Hires are only ever created by the
  Client themselves (issue #27); this feature only inspects and transitions
  existing engagements.
- Complete and Cancel are the only mutations, and both are only exposed on
  eligible Active (`!hoanThanh`) records — a Completed record exposes no
  terminal actions, and there is no way to roll a Complete back.

## Routes

- `/admin/hired-services?q=&page=&pageSize=&status=`
- `/admin/hired-services/:hiredServiceId?q=&page=&pageSize=&status=`

## Safeguards

- Complete/Cancel both refetch fresh evidence (`{ id, completed }`) before
  mutating; a changed `completed` flag or a record that has disappeared
  blocks with `Reload latest` rather than mutating against a stale view.
- Ambiguous mutation transport outcomes reconcile against fresh evidence and
  never automatically resend a mutation.
- Both confirmation dialogs identify the specific target in their title and
  button labels, and initially focus "Go back" — the least destructive
  action — never the destructive confirm button.
- Cancel removes the record only after the confirmed refetch/delete
  sequence; no Cancelled status, reason, Undo, or automatic retry is
  invented anywhere in the flow.

## Deterministic coverage

Routed tests cover list URL state (`q`/`page`/`pageSize`/`status`), the
client-fallback search disclosure, the current-page-only status filter
disclosure, truthful Client/Service/Seller/date/status/current-price
display, eligibility (Complete/Cancel hidden on Completed records),
Complete/Cancel happy paths, partial relation failure, not-found/forbidden
errors, and responsive behavior at 375/768/1440. A dedicated safeguards
suite covers stale and unknown-outcome Complete/Cancel, initial dialog
focus on the least destructive action, and keyboard-safe confirmation at
all three widths. Adapter tests cover the Cybersoft mapping — including the
lack of an id-scoped read — and the mutation boundary.
