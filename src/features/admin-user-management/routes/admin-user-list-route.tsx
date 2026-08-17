import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { useAdminUserList } from "../controller";
import { DeleteUserControl } from "../components/delete-user-control";
import { FailureMessage } from "../components/feedback";
import { isCanonicalRole } from "../user-form-model";
import {
  VALID_PAGE_SIZES,
  kindOf,
  pageSizeFrom,
  positiveInteger,
  withSearch,
} from "../route-utils";

export function AdminUserListRoute() {
  const { session } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const q = searchParams.get("q") ?? "";
  const page = positiveInteger(searchParams.get("page"), 1);
  const pageSize = pageSizeFrom(searchParams.get("pageSize"));
  const listQuery = useAdminUserList({ pageIndex: page, pageSize, keyword: q || undefined }, session?.token ?? "");
  const totalPages = listQuery.data ? Math.max(1, Math.ceil(listQuery.data.totalRow / pageSize)) : 1;

  useEffect(() => { document.title = "User Management | Administrator"; heading.current?.focus(); }, []);
  useEffect(() => {
    const canonical = new URLSearchParams();
    if (q) canonical.set("q", q);
    canonical.set("page", String(listQuery.data ? Math.min(page, totalPages) : page));
    canonical.set("pageSize", String(pageSize));
    if (canonical.toString() !== searchParams.toString()) setSearchParams(canonical, { replace: true });
  }, [listQuery.data, page, pageSize, q, searchParams, setSearchParams, totalPages]);

  const setListState = (next: { q: string; page: number; pageSize: number }, replace = false) => {
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    params.set("page", String(next.page));
    params.set("pageSize", String(next.pageSize));
    setSearchParams(params, { replace });
  };

  const listState = listQuery.isPending ? "loading" : listQuery.isError ? kindOf(listQuery.error)
    : listQuery.data?.data.length === 0 && q ? "query-empty"
      : listQuery.data?.data.length === 0 ? "empty" : "confirmed-success";

  return (
    <main id="main-content" className="admin-user-list">
      <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/admin">Overview</Link><span aria-hidden="true">/</span><span aria-current="page">Users</span>
      </nav>
      <header className="admin-page-heading admin-user-heading-row">
        <div><span className="admin-eyebrow">People & access</span><h1 ref={heading} tabIndex={-1}>User Management</h1>
          <p>Search, review, and manage marketplace user accounts.</p></div>
        <Link to="/admin/users/new" className="button admin-primary-action"><span aria-hidden="true">+</span> Create User</Link>
      </header>
      {listQuery.isPending && <div className="state-indicator" data-state="loading" role="status">Loading users...</div>}
      {listQuery.isRefetching && !listQuery.isPending && <div className="state-indicator" data-state="refreshing" role="status">Refreshing users...</div>}
      {listQuery.isError && <FailureMessage kind={kindOf(listQuery.error)} action="load" onRetry={() => void listQuery.refetch()} />}
      {listState === "empty" && <div className="state-indicator" data-state="empty" role="status">No users found.</div>}
      {listState === "query-empty" && <div className="state-indicator" data-state="query-empty" role="status">No users match your search for “{q}”.</div>}
      {location.state?.adminFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{location.state.adminFeedback}</div> : null}
      {deleteFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{deleteFeedback}</div> : null}
      {listState === "confirmed-success" && listQuery.data ? (
        <p className="user-list-scope" data-scope={listQuery.data.scope}>
          {listQuery.data.scope === "server"
            ? "User results are paginated and filtered by the User API."
            : "Pagination response was unusable, so this page is a client-filtered view of the complete User API snapshot."}
        </p>
      ) : null}

      <div className="user-list-controls">
        <div><label htmlFor="user-search">Search users</label><input id="user-search" type="search" value={q}
          placeholder="Search by name or email..." aria-label="Search users by name or email"
          onChange={(event) => setListState({ q: event.target.value, page: 1, pageSize }, true)} /></div>
        <div><label htmlFor="page-size-select">Page size</label><select id="page-size-select" value={pageSize}
          onChange={(event) => setListState({ q, page: 1, pageSize: Number(event.target.value) })}>
          {VALID_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} per page</option>)}
        </select></div>
        <div className="user-list-refresh"><span className="control-label" aria-hidden="true">Data</span>
          <button type="button" onClick={() => void listQuery.refetch()} disabled={listQuery.isPending || listQuery.isRefetching}>
            {listQuery.isRefetching ? "Refreshing..." : "Refresh users"}</button></div>
      </div>

      {listState === "confirmed-success" && listQuery.data ? <div className="user-list-table">
        <table role="grid" aria-label="User list">
          <thead><tr><th scope="col">User</th><th scope="col">Email</th><th scope="col">Phone</th><th scope="col">Role</th><th scope="col">Actions</th></tr></thead>
          <tbody>{listQuery.data.data.map((user) => <tr key={user.id}>
            <td data-label="User"><div className="admin-user-cell"><span className="admin-user-avatar" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span><span><strong>{user.name}</strong><small>ID {user.id}</small></span></div></td>
            <td data-label="Email">{user.email}</td><td data-label="Phone">{user.phone || "—"}</td>
            <td data-label="Role">{isCanonicalRole(user.role)
              ? <span className={`role-badge role-${user.role.toLowerCase()}`}>{user.role}</span>
              : <><span className="role-badge role-legacy">{user.role || "MISSING"}</span><span className="visually-hidden"> Unsupported legacy role</span></>}</td>
            <td data-label="Actions"><div className="row-actions">
              <Link aria-label={`View ${user.name}`} to={withSearch(`/admin/users/${user.id}`, location.search)}>View</Link>
              <Link aria-label={`Edit ${user.name}`} to={withSearch(`/admin/users/${user.id}/edit`, location.search)}>Edit</Link>
              <DeleteUserControl user={user} visibleLabel="Delete" className="link-button danger-link"
                onReloadLatest={() => void listQuery.refetch()} onDeleted={() => {
                  setDeleteFeedback(`User ${user.name} deleted successfully.`);
                  if (listQuery.data?.data.length === 1 && page > 1) setListState({ q, page: page - 1, pageSize }, true);
                  else void listQuery.refetch();
                }} />
            </div></td>
          </tr>)}</tbody>
        </table>
      </div> : null}

      {listState === "confirmed-success" && listQuery.data && totalPages > 1 ? <nav className="pagination" aria-label="Pagination">
        <button type="button" onClick={() => setListState({ q, page: page - 1, pageSize })} disabled={page <= 1}>Previous</button>
        <span>Page {page} of {totalPages} (Total: {listQuery.data.totalRow} users)</span>
        <button type="button" onClick={() => setListState({ q, page: page + 1, pageSize })} disabled={page >= totalPages}>Next</button>
      </nav> : null}
    </main>
  );
}
