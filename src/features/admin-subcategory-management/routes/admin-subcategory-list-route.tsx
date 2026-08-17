import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { DeleteSubcategoryControl } from "../components/delete-subcategory-control";
import { FailureMessage } from "../components/feedback";
import { useAdminSubcategoryList, useAdminTaxonomyCategories } from "../controller";
import { VALID_PAGE_SIZES, kindOf, pageSizeFrom, positiveInteger, withSearch } from "../route-utils";

export function AdminSubcategoryListRoute() {
  const { session } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation() as ReturnType<typeof useLocation> & { state?: { adminFeedback?: string } | null };
  const heading = useRef<HTMLHeadingElement>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const q = searchParams.get("q") ?? "";
  const page = positiveInteger(searchParams.get("page"), 1);
  const pageSize = pageSizeFrom(searchParams.get("pageSize"));
  const token = session?.token ?? "";
  const listQuery = useAdminSubcategoryList({ pageIndex: page, pageSize, keyword: q || undefined }, token);
  const categoriesQuery = useAdminTaxonomyCategories(token);
  const totalPages = listQuery.data ? Math.max(1, Math.ceil(listQuery.data.totalRow / pageSize)) : 1;
  const categoryNames = useMemo(
    () => new Map((categoriesQuery.data ?? []).map((category) => [category.id, category.name])),
    [categoriesQuery.data],
  );

  useEffect(() => {
    document.title = "Service Subcategory Management | Administrator";
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

  const refresh = () => {
    void listQuery.refetch();
    void categoriesQuery.refetch();
  };

  return <main id="main-content" className="admin-subcategory-list">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
      <Link to="/admin">Overview</Link><span aria-hidden="true">/</span><span aria-current="page">Service Subcategories</span>
    </nav>
    <header className="admin-page-heading admin-subcategory-heading-row">
      <div><span className="admin-eyebrow">Marketplace taxonomy</span><h1 ref={heading} tabIndex={-1}>Service Subcategory Management</h1>
        <p>Manage selectable Service Subcategories while preserving their Service Category and Service Group context.</p></div>
      <Link to={withSearch("/admin/subcategories/new", location.search)} className="button admin-primary-action"><span aria-hidden="true">+</span> Create Subcategory</Link>
    </header>

    {listQuery.isPending ? <div className="state-indicator" data-state="loading" role="status">Loading Service Subcategories...</div> : null}
    {listQuery.isRefetching && !listQuery.isPending ? <div className="state-indicator" data-state="refreshing" role="status">Refreshing Service Subcategories...</div> : null}
    {listQuery.isError ? <FailureMessage kind={kindOf(listQuery.error)} action="load" onRetry={refresh} /> : null}
    {listState === "empty" ? <div className="state-indicator" data-state="empty" role="status">No Service Subcategories found.</div> : null}
    {listState === "query-empty" ? <div className="state-indicator" data-state="query-empty" role="status">No Service Subcategories match your search for “{q}”.</div> : null}
    {location.state?.adminFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{location.state.adminFeedback}</div> : null}
    {deleteFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{deleteFeedback}</div> : null}
    {listState === "confirmed-success" && listQuery.data ? <p className="admin-subcategory-list-scope" data-scope={listQuery.data.scope}>
      {listQuery.data.scope === "server"
        ? "Service Subcategory results were returned by the paging endpoint. Proven Group and Category context is shown when the API supplies it."
        : "The paging response was incomplete, so this page safely uses the complete Group/Subcategory snapshot and paginates it locally."}
    </p> : null}

    <div className="admin-subcategory-list-controls">
      <div className="admin-subcategory-search"><label htmlFor="subcategory-search">Search Service Subcategories</label>
        <input id="subcategory-search" type="search" value={q} placeholder="Search by name..." aria-label="Search Service Subcategories by name"
          onChange={(event) => setListState({ q: event.target.value, page: 1, pageSize }, true)} /></div>
      <div className="admin-subcategory-page-size"><label htmlFor="subcategory-page-size">Page size</label>
        <select id="subcategory-page-size" value={pageSize} onChange={(event) => setListState({ q, page: 1, pageSize: Number(event.target.value) })}>
          {VALID_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} per page</option>)}
        </select></div>
      <div className="admin-subcategory-refresh"><span className="control-label" aria-hidden="true">Data</span>
        <button type="button" onClick={refresh} disabled={listQuery.isPending || listQuery.isRefetching}>
          {listQuery.isRefetching ? "Refreshing..." : "Refresh Subcategories"}</button></div>
    </div>

    {listState === "confirmed-success" && listQuery.data ? <div className="admin-subcategory-table">
      <table role="grid" aria-label="Service Subcategory list">
        <thead><tr><th scope="col">Service Subcategory</th><th scope="col">Service Group</th><th scope="col">Service Category</th><th scope="col">Identifier</th><th scope="col">Actions</th></tr></thead>
        <tbody>{listQuery.data.data.map((subcategory) => {
          const categoryName = subcategory.categoryId ? categoryNames.get(subcategory.categoryId) : undefined;
          return <tr key={subcategory.id}>
            <td data-label="Service Subcategory"><div className="admin-subcategory-primary"><span className="admin-subcategory-icon" aria-hidden="true">SC</span><div><strong>{subcategory.name}</strong><small>Selectable taxonomy leaf</small></div></div></td>
            <td data-label="Service Group">{subcategory.groupName ? <span className="taxonomy-context-chip">{subcategory.groupName}</span> : <span className="taxonomy-context-muted">Not reported</span>}</td>
            <td data-label="Service Category">{categoryName
              ? <span className="taxonomy-context-chip taxonomy-context-category">{categoryName}</span>
              : subcategory.categoryId
                ? <span className="taxonomy-context-muted">Category #{subcategory.categoryId}</span>
                : <span className="taxonomy-context-muted">Not reported</span>}</td>
            <td data-label="Identifier"><span className="taxonomy-id">{subcategory.id}</span></td>
            <td data-label="Actions"><div className="row-actions">
              <Link aria-label={`View ${subcategory.name}`} to={withSearch(`/admin/subcategories/${subcategory.id}`, location.search)}>View</Link>
              <Link aria-label={`Edit ${subcategory.name}`} to={withSearch(`/admin/subcategories/${subcategory.id}/edit`, location.search)}>Edit</Link>
              <DeleteSubcategoryControl subcategory={subcategory} visibleLabel="Delete" className="link-button danger-link"
                onReloadLatest={refresh} onDeleted={() => {
                  setDeleteFeedback(`Service Subcategory ${subcategory.name} deleted successfully.`);
                  if (listQuery.data?.data.length === 1 && page > 1) setListState({ q, page: page - 1, pageSize }, true);
                  else refresh();
                }} />
            </div></td>
          </tr>;
        })}</tbody>
      </table>
    </div> : null}

    {listState === "confirmed-success" && listQuery.data && totalPages > 1 ? <nav className="pagination" aria-label="Pagination">
      <button type="button" onClick={() => setListState({ q, page: page - 1, pageSize })} disabled={page <= 1}>Previous</button>
      <span>Page {page} of {totalPages} (Total: {listQuery.data.totalRow} Service Subcategories)</span>
      <button type="button" onClick={() => setListState({ q, page: page + 1, pageSize })} disabled={page >= totalPages}>Next</button>
    </nav> : null}
  </main>;
}
