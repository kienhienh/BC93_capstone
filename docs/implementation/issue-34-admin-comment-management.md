# Issue #34 — Administrator Comment Management

This implementation lets an Administrator list, search, view, create, edit,
and delete Comments, deriving authorship from the signed-in session and
never impersonating another User.

## Contract findings (verified against the live API, read-only)

A safe, read-only probe of the live Cybersoft API (per the established
read-only smoke-test policy) found:

- `GET /binh-luan/phan-trang-tim-kiem` — the declared Comment search/paging
  endpoint — returns **404** despite being published in Swagger. It is not
  usable at all, not merely untrustworthy.
- `GET /binh-luan/{id}` does not exist; only `PUT`/`DELETE` are declared at
  that path. There is no way to read a single Comment by id.
- `GET /binh-luan` (list all) returns the raw `BinhLuanViewModel` shape only
  (`id`, `maCongViec`, `maNguoiBinhLuan`, `ngayBinhLuan`, `noiDung`,
  `saoBinhLuan`) — no denormalized author name or Service title, unlike
  `cong-viec`, which does echo the seller's name inline.
- The live snapshot has ~3,427 Comments, 685 Users, and 36 Services, and
  contains junk/placeholder rows (`ngayBinhLuan` appears as ISO datetimes,
  plain dates, `DD/MM/YYYY`, and the literal string `"string"`; some rows
  have `maCongViec`/`maNguoiBinhLuan` of `0`). Date values are therefore
  treated as an opaque, unparsed display string, never validated or
  reformatted.
- `GET /binh-luan/lay-binh-luan-theo-cong-viec/{serviceId}` — already used
  by the public Service Detail page — is verified working and returns
  Comments enriched with author name (but not the numeric author id or
  Service id, both already known from context).

## Design consequences

- **No server-side search/pagination is ever attempted.** The list route
  fetches the complete Comment snapshot once (`GET /binh-luan`), then
  filters and paginates entirely client-side, with a permanent, truthful
  disclosure banner. `AdminCommentListResult.scope` is always
  `"client-fallback"` — there is no `"server"` mode for this feature, unlike
  Category/Service/Subcategory search.
- **Single-Comment evidence never refetches the full snapshot.** Since a
  Comment's Service is immutable, `refetchCommentEvidence` reuses the
  verified per-Service comment read to cheaply confirm one Comment's current
  `content`/`rating` before edit or delete, instead of re-pulling all 3,427
  records.
- **Author and Service names are looked up separately and non-blockingly.**
  `listAllServices` (36 records) and `listAllAuthors` (685 records, every
  User field but `id`/`name` discarded at the boundary) are fetched once and
  joined by id in the browser. If either fails while Comments loaded fine,
  the list/detail still renders — falling back to `Service #<id>` /
  `User #<id>` — behind a non-blocking `partial-relation-failure` banner,
  rather than taking Comment moderation down over an unrelated lookup.
- **Update responses are not trusted.** `PUT /binh-luan/{id}` accepts the
  full record; the adapter never parses its body and instead echoes back
  exactly what was sent, mirroring the same choice made for Category/Group
  mutations in #32/#33.

## Authorship and preserved fields

- Create has no author picker: `authorId` is always `session.user.id`.
- Edit always resubmits the verified baseline's `serviceId`, `authorId`, and
  `createdAt` unchanged; only `content` and `rating` come from the form.

## Routes

- `/admin/comments?q=&page=&pageSize=`
- `/admin/comments/new`
- `/admin/comments/:commentId?q=&page=&pageSize=`
- `/admin/comments/:commentId/edit?q=&page=&pageSize=`

## Safeguards

- Create refetches the complete Service list immediately before submitting
  and blocks if the chosen Service no longer exists.
- Edit/delete refetch fresh per-Service evidence before mutating; changed
  content/rating blocks with `Reload latest`, and a Comment that no longer
  appears in that evidence is treated as already gone.
- Ambiguous mutation transport outcomes reconcile against fresh per-Service
  evidence and never automatically resend a mutation.
- Unsaved non-secret form work warns before link navigation or page unload.

## Deterministic coverage

Routed tests cover list URL state, client-side search/pagination
disclosure, session-derived authorship, preserved-field edits, partial
relation failure, not-found/forbidden errors, stale and unknown-outcome
safeguards, unsaved-work warnings, and responsive/focus behavior at
375/768/1440. Adapter tests cover the Cybersoft mapping — including
tolerance of the live snapshot's junk rows — and the mutation boundary.
