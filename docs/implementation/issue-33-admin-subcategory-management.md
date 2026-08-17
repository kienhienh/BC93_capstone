# Issue #33 — Administrator Service Group and Subcategory Management

This implementation lets an Administrator manage Service Subcategory identity
and Service Group membership without flattening the Service Category →
Service Group → Service Subcategory hierarchy, and without any capability the
live Cybersoft contract does not support.

## Contract shape and its consequences

The `chi-tiet-loai-cong-viec` resource covers two distinct concepts:

- Plain CRUD (`GET`/`POST`/`PUT`/`DELETE /chi-tiet-loai-cong-viec[/{id}]`, using
  `ChiTietLoaiView { id, tenChiTiet }`) manages **Subcategory identity only** —
  a name, nothing else. Creating one does not attach it to a Group.
- `POST .../them-nhom-chi-tiet-loai` and `PUT .../sua-nhom-chi-tiet-loai/{id}`
  (using `ChiTietLoaiCongViecViewModel { id, tenChiTiet, maLoaiCongViec,
  danhSachChiTiet }`) create/edit a **Service Group**: a name, its parent
  Category, and the *complete* list of member Subcategory ids.

There is no Group list/detail read endpoint and no Group delete endpoint. The
only way to see current Group identity or membership is the read-only
Category hierarchy (`GET /cong-viec/lay-chi-tiet-loai-cong-viec/{id}`, the
same endpoint Issue #32 uses). This drives three decisions:

1. **No standalone Group route.** "Add Service Group" and "Edit Service
   Group" are reached only from a Category's Detail page (extended from
   #32), scoped to that Category's already-loaded hierarchy.
2. **Group mutation responses are not rendered.** `createGroup`/`updateGroup`
   return `Promise<void>` — a 2xx confirms the request was accepted, nothing
   more. Every screen re-reads the Category hierarchy afterward as the only
   source of truth, exactly like #32 already does for Category evidence.
3. **No Group delete UI**, matching the scope exclusion; there is no
   endpoint to call.

## Cross-Group ambiguity

A Subcategory can only meaningfully belong to one Group, but editing Group
B's membership cannot tell the server to remove a Subcategory from Group A —
there is no reassignment operation, only "this Group's complete member set."
`useAdminMembershipIndex` scans every Category's hierarchy once to build a
`subcategoryId → { categoryId, categoryName, groupId, groupName }` map. The
Group membership picker disables any Subcategory already owned by a
*different* Group, with an inline explanation, and the same check re-runs
against fresh evidence immediately before every create/update submission.
Moving a Subcategory means editing the other Group first.

## Routes

- `/admin/subcategories?q=&page=&pageSize=`
- `/admin/subcategories/new`
- `/admin/subcategories/:subcategoryId?q=&page=&pageSize=`
- `/admin/subcategories/:subcategoryId/edit?q=&page=&pageSize=`
- `/admin/subcategories/groups/:categoryId/new` (linked from Category Detail)
- `/admin/subcategories/groups/:categoryId/:groupId/edit` (linked per Group
  card on Category Detail)

## Safeguards

- Subcategory names are normalized, locally validated, and checked against a
  fresh complete Subcategory snapshot before create/update.
- Group names are checked for duplicates within their own Category's fresh
  hierarchy before create/update.
- Delete refetches the target Subcategory and a fresh membership index, then
  blocks when the Subcategory is still a Group member or absence cannot be
  proven; there is no cascade or automatic removal.
- Group edits refetch the Category hierarchy and membership index
  immediately before mutating; a changed Group (name or membership) blocks
  with `Reload latest`, and no force-overwrite path exists.
- Every membership change is summarized in a confirmation dialog (Category,
  Group, and the added/removed/unchanged Subcategory names) before the
  mutation is sent.
- Ambiguous mutation transport outcomes reconcile against a fresh Category
  hierarchy read and never automatically resend a mutation.

## Deterministic coverage

Routed tests cover Subcategory list URL state, CRUD, duplicate/name
validation, Group membership display, errors, Group create/edit with
confirmation summaries, cross-Group ambiguity blocking, dependency-proven
Subcategory delete, stale and unknown outcomes, and responsive/focus
behavior at 375/768/1440. Adapter tests cover the Cybersoft mapping and
mutation boundary for both Subcategory and Group endpoints.
