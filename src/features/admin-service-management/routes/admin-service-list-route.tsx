import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { useAdminServiceList } from "../controller";
import { DeleteServiceControl } from "../components/delete-service-control";
import { FailureMessage } from "../components/feedback";
import {
  VALID_PAGE_SIZES,
  kindOf,
  pageSizeFrom,
  positiveInteger,
  withSearch,
} from "../route-utils";

export function AdminServiceListRoute() {
  const { session } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation() as ReturnType<typeof useLocation> & {
    state?: { adminFeedback?: string; createdServiceId?: string } | null;
  };
  const heading = useRef<HTMLHeadingElement>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const q = searchParams.get("q") ?? "";
  const page = positiveInteger(searchParams.get("page"), 1);
  const pageSize = pageSizeFrom(searchParams.get("pageSize"));
  const listQuery = useAdminServiceList({ pageIndex: page, pageSize, keyword: q || undefined }, session?.token ?? "");
  const totalPages = listQuery.data ? Math.max(1, Math.ceil(listQuery.data.totalRow / pageSize)) : 1;

  useEffect(() => { document.title = "Service Management | Administrator"; heading.current?.focus(); }, []);
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
    <main id="main-content" className="admin-service-list">
      <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/admin">Overview</Link><span aria-hidden="true">/</span><span aria-current="page">Services</span>
      </nav>
      <header className="admin-page-heading admin-service-heading-row">
        <div><span className="admin-eyebrow">Marketplace catalog</span><h1 ref={heading} tabIndex={-1}>Service Management</h1>
          <p>Search, review, and manage marketplace Services.</p></div>
        <Link to="/admin/services/new" className="button admin-primary-action"><span aria-hidden="true">+</span> Create Service</Link>
      </header>
      {listQuery.isPending && <div className="state-indicator" data-state="loading" role="status">Loading Services...</div>}
      {listQuery.isRefetching && !listQuery.isPending && <div className="state-indicator" data-state="refreshing" role="status">Refreshing Services...</div>}
      {listQuery.isError && <FailureMessage kind={kindOf(listQuery.error)} action="load" onRetry={() => void listQuery.refetch()} />}
      {listState === "empty" && <div className="state-indicator" data-state="empty" role="status">No Services found.</div>}
      {listState === "query-empty" && <div className="state-indicator" data-state="query-empty" role="status">No Services match your search for “{q}”.</div>}
      {location.state?.adminFeedback ? (
        <div className="state-indicator" data-state="confirmed-success" role="status">
          {location.state.adminFeedback}
          {location.state.createdServiceId ? (
            <Link to={`/admin/services/${location.state.createdServiceId}/edit`}> Add an image now</Link>
          ) : null}
        </div>
      ) : null}
      {deleteFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{deleteFeedback}</div> : null}
      {listState === "confirmed-success" && listQuery.data ? (
        <p className="admin-list-scope" data-scope={listQuery.data.scope}>
          {listQuery.data.scope === "server"
            ? "Service results are paginated and filtered by the Service API."
            : "Pagination response was unusable, so this page is a client-filtered view of the complete Service API snapshot."}
        </p>
      ) : null}

      <div className="admin-list-controls">
        <div><label htmlFor="service-search">Search Services</label><input id="service-search" type="search" value={q}
          placeholder="Search by title..." aria-label="Search Services by title"
          onChange={(event) => setListState({ q: event.target.value, page: 1, pageSize }, true)} /></div>
        <div><label htmlFor="page-size-select">Page size</label><select id="page-size-select" value={pageSize}
          onChange={(event) => setListState({ q, page: 1, pageSize: Number(event.target.value) })}>
          {VALID_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} per page</option>)}
        </select></div>
        <div className="admin-list-refresh"><span className="control-label" aria-hidden="true">Data</span>
          <button type="button" onClick={() => void listQuery.refetch()} disabled={listQuery.isPending || listQuery.isRefetching}>
            {listQuery.isRefetching ? "Refreshing..." : "Refresh Services"}</button></div>
      </div>

      {listState === "confirmed-success" && listQuery.data ? <div className="admin-data-table">
        <table role="grid" aria-label="Service list">
          <thead><tr><th scope="col">Service</th><th scope="col">Seller</th><th scope="col">Price</th><th scope="col">Rating</th><th scope="col">Actions</th></tr></thead>
          <tbody>{listQuery.data.data.map((service) => <tr key={service.id}>
            <td data-label="Service"><div className="admin-service-cell"><span className="admin-service-avatar" aria-hidden="true">{service.title.charAt(0).toUpperCase()}</span><span><strong>{service.title}</strong><small>ID {service.id}</small></span></div></td>
            <td data-label="Seller">{service.sellerName ?? `User ${service.sellerId}`}</td>
            <td data-label="Price">${service.price}</td>
            <td data-label="Rating">{service.rating.toFixed(1)} <small>({service.reviewCount})</small></td>
            <td data-label="Actions"><div className="row-actions">
              <Link aria-label={`View ${service.title}`} to={withSearch(`/admin/services/${service.id}`, location.search)}>View</Link>
              <Link aria-label={`Edit ${service.title}`} to={withSearch(`/admin/services/${service.id}/edit`, location.search)}>Edit</Link>
              <DeleteServiceControl service={service} visibleLabel="Delete" className="link-button danger-link"
                onReloadLatest={() => void listQuery.refetch()} onDeleted={() => {
                  setDeleteFeedback(`Service ${service.title} deleted successfully.`);
                  if (listQuery.data?.data.length === 1 && page > 1) setListState({ q, page: page - 1, pageSize }, true);
                  else void listQuery.refetch();
                }} />
            </div></td>
          </tr>)}</tbody>
        </table>
      </div> : null}

      {listState === "confirmed-success" && listQuery.data && totalPages > 1 ? <nav className="pagination" aria-label="Pagination">
        <button type="button" onClick={() => setListState({ q, page: page - 1, pageSize })} disabled={page <= 1}>Previous</button>
        <span>Page {page} of {totalPages} (Total: {listQuery.data.totalRow} Services)</span>
        <button type="button" onClick={() => setListState({ q, page: page + 1, pageSize })} disabled={page >= totalPages}>Next</button>
      </nav> : null}
    </main>
  );
}
