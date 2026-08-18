import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { CancelHiredServiceControl } from "../components/cancel-hired-service-control";
import { CompleteHiredServiceControl } from "../components/complete-hired-service-control";
import { FailureMessage } from "../components/feedback";
import { useAdminAllHiredServices, useAdminHiredServiceServices, useAdminHiredServiceUsers } from "../controller";
import { kindOf, listPath } from "../route-utils";

export function AdminHiredServiceDetailRoute() {
  const { hiredServiceId = "" } = useParams();
  const { session } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const hiredServicesQuery = useAdminAllHiredServices(session?.token ?? "");
  const servicesQuery = useAdminHiredServiceServices(session?.token ?? "");
  const usersQuery = useAdminHiredServiceUsers(session?.token ?? "");
  const back = listPath(location.search);

  useEffect(() => {
    document.title = "Hired Service Detail | Administrator";
    heading.current?.focus();
  }, []);

  const hiredService = hiredServicesQuery.data?.find((item) => item.id === hiredServiceId) ?? null;
  const notFound = Boolean(hiredServicesQuery.data) && !hiredService;
  const service = hiredService ? servicesQuery.data?.find((item) => item.id === hiredService.serviceId) ?? null : null;
  const serviceTitle = hiredService ? service?.title ?? `Service #${hiredService.serviceId}` : null;
  const clientName = hiredService ? usersQuery.data?.find((user) => user.id === hiredService.clientId)?.name ?? `User #${hiredService.clientId}` : null;
  const sellerName = service?.sellerId
    ? usersQuery.data?.find((user) => user.id === service.sellerId)?.name ?? `User #${service.sellerId}`
    : "Unknown seller";
  const partialRelationFailure = Boolean(hiredService) && (servicesQuery.isError || usersQuery.isError);

  return <main id="main-content" className="admin-hired-service-detail">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to={back}>Hired Services</Link><span aria-hidden="true">/</span><span aria-current="page">Detail</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">Engagement record</span><h1 ref={heading} tabIndex={-1}>Hired Service Detail</h1><p>Review the Client, Service, Seller, and current status of this engagement.</p></div></header>

    {hiredServicesQuery.isPending ? <div className="state-indicator" data-state="loading" role="status">Loading Hired Service...</div> : null}
    {hiredServicesQuery.isRefetching && !hiredServicesQuery.isPending ? <div className="state-indicator" data-state="refreshing" role="status">Refreshing Hired Service...</div> : null}
    {hiredServicesQuery.isError ? <FailureMessage kind={kindOf(hiredServicesQuery.error)} action="load" onRetry={() => void hiredServicesQuery.refetch()} /> : null}
    {notFound ? <div className="state-indicator" data-state="not-found" role="alert">Hired Service not found.</div> : null}
    {partialRelationFailure ? <div className="state-indicator" data-state="partial-relation-failure" role="status">
      <span>Some Service or User names could not be loaded. This Hired Service may show numeric identifiers instead of names.</span>
    </div> : null}

    {hiredService ? <>
      <section className="admin-hired-service-detail-card" aria-labelledby="hired-service-record-title">
        <span className="admin-eyebrow">Hired Service</span><h2 id="hired-service-record-title">Hired Service {hiredService.id}</h2>
        <span className="admin-hired-service-status-badge" data-status={hiredService.completed ? "completed" : "active"}>
          {hiredService.completed ? "Completed" : "Active"}</span>
        <dl className="admin-hired-service-meta">
          <div><dt>Client</dt><dd>{clientName}</dd></div>
          <div><dt>Service</dt><dd>{serviceTitle}</dd></div>
          <div><dt>Seller</dt><dd>{sellerName}</dd></div>
          <div><dt>Hire date</dt><dd>{hiredService.hiredAt}</dd></div>
          <div><dt>Current price</dt><dd>{service?.price ?? "—"}</dd></div>
        </dl>
        {service ? <p className="admin-hired-service-price-note">
          Current price reflects the Service today; it is not necessarily the amount paid at hire time.
        </p> : null}
      </section>

      <nav className="detail-actions" aria-label="Hired Service detail actions">
        <Link to={back}>Back to list</Link>
        {!hiredService.completed ? <>
          <CompleteHiredServiceControl hiredService={hiredService} visibleLabel="Complete Hired Service" className="primary-button"
            onReloadLatest={() => void hiredServicesQuery.refetch()}
            onCompleted={() => navigate(back, { replace: true, state: { adminFeedback: `Hired Service ${hiredService.id} completed successfully.` } })} />
          <CancelHiredServiceControl hiredService={hiredService} visibleLabel="Cancel Hired Service" className="danger-button"
            onReloadLatest={() => void hiredServicesQuery.refetch()}
            onCancelled={() => navigate(back, { replace: true, state: { adminFeedback: `Hired Service ${hiredService.id} cancelled successfully.` } })} />
        </> : null}
      </nav>
    </> : null}
  </main>;
}
