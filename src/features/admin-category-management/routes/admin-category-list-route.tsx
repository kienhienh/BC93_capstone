import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { DeleteCategoryControl } from "../components/delete-category-control";
import { FailureMessage } from "../components/feedback";
import { useAdminCategoryList } from "../controller";
import { VALID_PAGE_SIZES, kindOf, pageSizeFrom, positiveInteger, withSearch } from "../route-utils";

export function AdminCategoryListRoute() {
  const { session } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation() as ReturnType<typeof useLocation> & { state?: { adminFeedback?: string } | null };
  const heading = useRef<HTMLHeadingElement>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const q = searchParams.get("q") ?? "";
  const page = positiveInteger(searchParams.get("page"), 1);
  const pageSize = pageSizeFrom(searchParams.get("pageSize"));
  const listQuery = useAdminCategoryList({ pageIndex: page, pageSize, keyword: q || undefined }, session?.token ?? "");
  const totalPages = listQuery.data ? Math.max(1, Math.ceil(listQuery.data.totalRow / pageSize)) : 1;

  useEffect(() => {
    document.title = "Service Category Management | Administrator";
    heading.current?.focus();
  }, []);

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

  return <main id="main-content" className="admin-category-list">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
      <Link to="/admin">Overview</Link><span aria-hidden="true">/</span><span aria-current="page">Service Categories</span>
    </nav>
    <header className="admin-page-heading admin-category-heading-row">
      <div><span className="admin-eyebrow">Marketplace taxonomy</span><h1 ref={heading} tabIndex={-1}>Service Category Management</h1>
        <p>Manage top-level Service Categories without changing Group or Subcategory membership.</p></div>
      <Link to={withSearch("/admin/categories/new", location.search)} className="button admin-primary-action"><span aria-hidden="true">+</span> Create Category</Link>
    </header>

    {listQuery.isPending ? <div className="state-indicator" data-state="loading" role="status">Loading Service Categories...</div> : null}
    {listQuery.isRefetching && !listQuery.isPending ? <div className="state-indicator" data-state="refreshing" role="status">Refreshing Service Categories...</div> : null}
    {listQuery.isError ? <FailureMessage kind={kindOf(listQuery.error)} action="load" onRetry={() => void listQuery.refetch()} /> : null}
    {listState === "empty" ? <div className="state-indicator" data-state="empty" role="status">No Service Categories found.</div> : null}
    {listState === "query-empty" ? <div className="state-indicator" data-state="query-empty" role="status">No Service Categories match your search for “{q}”.</div> : null}
    {location.state?.adminFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{location.state.adminFeedback}</div> : null}
    {deleteFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{deleteFeedback}</div> : null}
    {listState === "confirmed-success" && listQuery.data ? <p className="admin-category-list-scope" data-scope={listQuery.data.scope}>
      {listQuery.data.scope === "server"
        ? "Service Category results are paginated and filtered by the Category API."
        : "The paging response was unusable, so this page is a client-filtered view of the complete Category API snapshot."}
    </p> : null}

    <div className="admin-category-list-controls">
      <div><label htmlFor="category-search">Search Service Categories</label>
        <input id="category-search" type="search" value={q} placeholder="Search by name..." aria-label="Search Service Categories by name"
          onChange={(event) => setListState({ q: event.target.value, page: 1, pageSize }, true)} /></div>
      <div><label htmlFor="category-page-size">Page size</label>
        <select id="category-page-size" value={pageSize} onChange={(event) => setListState({ q, page: 1, pageSize: Number(event.target.value) })}>
          {VALID_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} per page</option>)}
        </select></div>
      <div className="admin-category-refresh"><span className="control-label" aria-hidden="true">Data</span>
        <button type="button" onClick={() => void listQuery.refetch()} disabled={listQuery.isPending || listQuery.isRefetching}>
          {listQuery.isRefetching ? "Refreshing..." : "Refresh Categories"}</button></div>
    </div>

    {listState === "confirmed-success" && listQuery.data ? <div className="admin-category-table">
      <table role="grid" aria-label="Service Category list">
        <thead><tr><th scope="col">Service Category</th><th scope="col">Identifier</th><th scope="col">Actions</th></tr></thead>
        <tbody>{listQuery.data.data.map((category) => <tr key={category.id}>
          <td data-label="Service Category"><div className="admin-category-cell"><span className="admin-category-avatar" aria-hidden="true">{category.name.charAt(0).toUpperCase()}</span><strong>{category.name}</strong></div></td>
          <td data-label="Identifier">{category.id}</td>
          <td data-label="Actions"><div className="row-actions">
            <Link aria-label={`View ${category.name}`} to={withSearch(`/admin/categories/${category.id}`, location.search)}>View</Link>
            <Link aria-label={`Edit ${category.name}`} to={withSearch(`/admin/categories/${category.id}/edit`, location.search)}>Edit</Link>
            <DeleteCategoryControl category={category} visibleLabel="Delete" className="link-button danger-link"
              onReloadLatest={() => void listQuery.refetch()} onDeleted={() => {
                setDeleteFeedback(`Service Category ${category.name} deleted successfully.`);
                if (listQuery.data?.data.length === 1 && page > 1) setListState({ q, page: page - 1, pageSize }, true);
                else void listQuery.refetch();
              }} />
          </div></td>
        </tr>)}</tbody>
      </table>
    </div> : null}

    {listState === "confirmed-success" && listQuery.data && totalPages > 1 ? <nav className="pagination" aria-label="Pagination">
      <button type="button" onClick={() => setListState({ q, page: page - 1, pageSize })} disabled={page <= 1}>Previous</button>
      <span>Page {page} of {totalPages} (Total: {listQuery.data.totalRow} Service Categories)</span>
      <button type="button" onClick={() => setListState({ q, page: page + 1, pageSize })} disabled={page >= totalPages}>Next</button>
    </nav> : null}
  </main>;
}
