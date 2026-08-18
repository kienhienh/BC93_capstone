import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { CancelHiredServiceControl } from "../components/cancel-hired-service-control";
import { CompleteHiredServiceControl } from "../components/complete-hired-service-control";
import { FailureMessage } from "../components/feedback";
import { useAdminAllHiredServices, useAdminHiredServiceServices, useAdminHiredServiceUsers } from "../controller";
import { filterCurrentPageByStatus, searchAndPaginateHiredServices } from "../hired-service-safeguards";
import { STATUS_FILTERS, VALID_PAGE_SIZES, kindOf, pageSizeFrom, positiveInteger, statusFilterFrom, withSearch, type StatusFilter } from "../route-utils";

export function AdminHiredServiceListRoute() {
  const { session } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation() as ReturnType<typeof useLocation> & { state?: { adminFeedback?: string } | null };
  const heading = useRef<HTMLHeadingElement>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const q = searchParams.get("q") ?? "";
  const page = positiveInteger(searchParams.get("page"), 1);
  const pageSize = pageSizeFrom(searchParams.get("pageSize"));
  const status = statusFilterFrom(searchParams.get("status"));
  const hiredServicesQuery = useAdminAllHiredServices(session?.token ?? "");
  const servicesQuery = useAdminHiredServiceServices(session?.token ?? "");
  const usersQuery = useAdminHiredServiceUsers(session?.token ?? "");

  useEffect(() => {
    document.title = "Hired Service Management | Administrator";
    heading.current?.focus();
  }, []);

  const serviceOf = (id: string) => servicesQuery.data?.find((service) => service.id === id) ?? null;
  const serviceTitleOf = (id: string) => serviceOf(id)?.title ?? `Service #${id}`;
  const userNameOf = (id: string) => usersQuery.data?.find((user) => user.id === id)?.name ?? `User #${id}`;
  const sellerNameOf = (serviceId: string) => {
    const sellerId = serviceOf(serviceId)?.sellerId;
    return sellerId ? userNameOf(sellerId) : "Unknown seller";
  };

  const result = hiredServicesQuery.data
    ? searchAndPaginateHiredServices(hiredServicesQuery.data, { pageIndex: page, pageSize, keyword: q || undefined },
      (hiredService) => `${userNameOf(hiredService.clientId)} ${serviceTitleOf(hiredService.serviceId)} ${sellerNameOf(hiredService.serviceId)}`)
    : null;
  const totalPages = result ? Math.max(1, Math.ceil(result.totalRow / pageSize)) : 1;
  const visibleRows = result ? filterCurrentPageByStatus(result.data, status) : [];

  useEffect(() => {
    const canonical = new URLSearchParams();
    if (q) canonical.set("q", q);
    canonical.set("page", String(result ? Math.min(page, totalPages) : page));
    canonical.set("pageSize", String(pageSize));
    if (status !== "all") canonical.set("status", status);
    if (canonical.toString() !== searchParams.toString()) setSearchParams(canonical, { replace: true });
  }, [result, page, pageSize, q, status, searchParams, setSearchParams, totalPages]);

  const setListState = (next: { q: string; page: number; pageSize: number; status: StatusFilter }, replace = false) => {
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    params.set("page", String(next.page));
    params.set("pageSize", String(next.pageSize));
    if (next.status !== "all") params.set("status", next.status);
    setSearchParams(params, { replace });
  };

  const listState = hiredServicesQuery.isPending ? "loading" : hiredServicesQuery.isError ? kindOf(hiredServicesQuery.error)
    : result?.data.length === 0 && q ? "query-empty"
      : result?.data.length === 0 ? "empty" : "confirmed-success";
  const partialRelationFailure = Boolean(hiredServicesQuery.data) && (servicesQuery.isError || usersQuery.isError);

  return <main id="main-content" className="admin-hired-service-list">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
      <Link to="/admin">Overview</Link><span aria-hidden="true">/</span><span aria-current="page">Hired Services</span>
    </nav>
    <header className="admin-page-heading admin-hired-service-heading-row">
      <div><span className="admin-eyebrow">Marketplace engagements</span><h1 ref={heading} tabIndex={-1}>Hired Service Management</h1>
        <p>Inspect Hired Services and complete or cancel eligible Active engagements.</p></div>
    </header>

    <p className="admin-hired-service-list-scope" data-scope="client-fallback">
      The Hired Service API's keyword search does not work server-side; this list is searched and paginated from the complete snapshot.
    </p>
    <p className="admin-hired-service-status-scope" data-scope="current-page-only">
      The status filter below only affects rows already on the current page — it does not change the total count or re-run the search.
    </p>

    {hiredServicesQuery.isPending ? <div className="state-indicator" data-state="loading" role="status">Loading Hired Services...</div> : null}
    {hiredServicesQuery.isRefetching && !hiredServicesQuery.isPending ? <div className="state-indicator" data-state="refreshing" role="status">Refreshing Hired Services...</div> : null}
    {hiredServicesQuery.isError ? <FailureMessage kind={kindOf(hiredServicesQuery.error)} action="load" onRetry={() => void hiredServicesQuery.refetch()} /> : null}
    {partialRelationFailure ? <div className="state-indicator" data-state="partial-relation-failure" role="status">
      <span>Some Service or User names could not be loaded. Hired Services below may show numeric identifiers instead of names.</span>
      <button type="button" className="state-retry" onClick={() => { void servicesQuery.refetch(); void usersQuery.refetch(); }}>Try relations again</button>
    </div> : null}
    {listState === "empty" ? <div className="state-indicator" data-state="empty" role="status">No Hired Services found.</div> : null}
    {listState === "query-empty" ? <div className="state-indicator" data-state="query-empty" role="status">No Hired Services match your search for “{q}”.</div> : null}
    {location.state?.adminFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{location.state.adminFeedback}</div> : null}
    {actionFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{actionFeedback}</div> : null}

    <div className="admin-hired-service-list-controls">
      <div><label htmlFor="hired-service-search">Search Hired Services</label>
        <input id="hired-service-search" type="search" value={q} placeholder="Search by client, service, or seller..." aria-label="Search Hired Services by client, service, or seller"
          onChange={(event) => setListState({ q: event.target.value, page: 1, pageSize, status }, true)} /></div>
      <div><label htmlFor="hired-service-status">Status (current page only)</label>
        <select id="hired-service-status" value={status} onChange={(event) => setListState({ q, page, pageSize, status: statusFilterFrom(event.target.value) }, true)}>
          {STATUS_FILTERS.map((option) => <option key={option} value={option}>{option === "all" ? "All" : option === "active" ? "Active" : "Completed"}</option>)}
        </select></div>
      <div><label htmlFor="hired-service-page-size">Page size</label>
        <select id="hired-service-page-size" value={pageSize} onChange={(event) => setListState({ q, page: 1, pageSize: Number(event.target.value), status })}>
          {VALID_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} per page</option>)}
        </select></div>
      <div className="admin-hired-service-refresh"><span className="control-label" aria-hidden="true">Data</span>
        <button type="button" onClick={() => void hiredServicesQuery.refetch()} disabled={hiredServicesQuery.isPending || hiredServicesQuery.isRefetching}>
          {hiredServicesQuery.isRefetching ? "Refreshing..." : "Refresh Hired Services"}</button></div>
    </div>

    {listState === "confirmed-success" && result ? <div className="admin-hired-service-table">
      <table role="grid" aria-label="Hired Service list">
        <thead><tr><th scope="col">Client</th><th scope="col">Service</th><th scope="col">Seller</th><th scope="col">Hire date</th><th scope="col">Status</th><th scope="col">Current price</th><th scope="col">Actions</th></tr></thead>
        <tbody>{visibleRows.map((hiredService) => <tr key={hiredService.id}>
          <td data-label="Client">{userNameOf(hiredService.clientId)}</td>
          <td data-label="Service">{serviceTitleOf(hiredService.serviceId)}</td>
          <td data-label="Seller">{sellerNameOf(hiredService.serviceId)}</td>
          <td data-label="Hire date">{hiredService.hiredAt}</td>
          <td data-label="Status"><span className="admin-hired-service-status-badge" data-status={hiredService.completed ? "completed" : "active"}>
            {hiredService.completed ? "Completed" : "Active"}</span></td>
          <td data-label="Current price">{serviceOf(hiredService.serviceId)?.price ?? "—"}</td>
          <td data-label="Actions"><div className="row-actions">
            <Link aria-label={`View Hired Service ${hiredService.id}`} to={withSearch(`/admin/hired-services/${hiredService.id}`, location.search)}>View</Link>
            {!hiredService.completed ? <>
              <CompleteHiredServiceControl hiredService={hiredService} visibleLabel="Complete" className="link-button"
                onReloadLatest={() => void hiredServicesQuery.refetch()} onCompleted={() => {
                  setActionFeedback(`Hired Service ${hiredService.id} completed successfully.`);
                  void hiredServicesQuery.refetch();
                }} />
              <CancelHiredServiceControl hiredService={hiredService} visibleLabel="Cancel" className="link-button danger-link"
                onReloadLatest={() => void hiredServicesQuery.refetch()} onCancelled={() => {
                  setActionFeedback(`Hired Service ${hiredService.id} cancelled successfully.`);
                  if (result.data.length === 1 && page > 1) setListState({ q, page: page - 1, pageSize, status }, true);
                  else void hiredServicesQuery.refetch();
                }} />
            </> : null}
          </div></td>
        </tr>)}</tbody>
      </table>
      {visibleRows.length === 0 ? <p className="admin-hired-service-status-scope" data-scope="current-page-only">No rows on this page match the selected status.</p> : null}
    </div> : null}

    {listState === "confirmed-success" && result && totalPages > 1 ? <nav className="pagination" aria-label="Pagination">
      <button type="button" onClick={() => setListState({ q, page: page - 1, pageSize, status })} disabled={page <= 1}>Previous</button>
      <span>Page {page} of {totalPages} (Total: {result.totalRow} Hired Services)</span>
      <button type="button" onClick={() => setListState({ q, page: page + 1, pageSize, status })} disabled={page >= totalPages}>Next</button>
    </nav> : null}
  </main>;
}
