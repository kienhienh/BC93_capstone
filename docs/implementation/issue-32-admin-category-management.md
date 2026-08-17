# Issue #32 — Administrator Service Category Management

This implementation keeps Service Category CRUD separate from the read-only
Category → Service Group → Service Subcategory hierarchy used for dependency
proof. It intentionally exposes no Group/Subcategory mutation, cascade delete,
reparenting, membership editing, bulk action, or speculative cleanup path.

## Routes

- `/admin/categories?q=&page=&pageSize=`
- `/admin/categories/new?q=&page=&pageSize=`
- `/admin/categories/:categoryId?q=&page=&pageSize=`
- `/admin/categories/:categoryId/edit?q=&page=&pageSize=`

## API boundary

Category CRUD uses the `loai-cong-viec` resource:

- `GET /loai-cong-viec`
- `GET /loai-cong-viec/phan-trang-tim-kiem`
- `GET /loai-cong-viec/{id}`
- `POST /loai-cong-viec`
- `PUT /loai-cong-viec/{id}`
- `DELETE /loai-cong-viec/{id}`

Dependency evidence is read only through:

- `GET /cong-viec/lay-chi-tiet-loai-cong-viec/{id}`

## Safeguards

- Category names are normalized, locally validated, and checked against a
  fresh complete Category snapshot before create/update.
- Server validation is attached to the Category name field.
- Update refetches the target and hierarchy before mutation.
- Delete refetches the target and hierarchy, then blocks when any Group or
  Subcategory remains or when absence cannot be proven.
- Stale target evidence requires `Reload latest`; there is no force overwrite.
- Ambiguous mutation transport outcomes reconcile with fresh reads and never
  automatically resend a destructive mutation.
- Dirty non-secret form work warns before link navigation or page unload.

## Deterministic coverage

Routed tests cover list URL state, CRUD, hierarchy rendering, duplicate/name
validation, errors, dependency proof, stale and unknown outcomes, unsaved work,
and responsive/focus behavior at 375/768/1440. Adapter tests cover the
Cybersoft mapping and mutation boundary.
