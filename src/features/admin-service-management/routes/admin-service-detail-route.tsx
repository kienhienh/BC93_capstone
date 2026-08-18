import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { useAdminServiceDetail } from "../controller";
import { DeleteServiceControl } from "../components/delete-service-control";
import { FailureMessage } from "../components/feedback";
import { kindOf, listPath, withSearch } from "../route-utils";

export function AdminServiceDetailRoute({ serviceId: suppliedServiceId }: { serviceId?: string } = {}) {
  const { serviceId: routeServiceId } = useParams();
  const serviceId = suppliedServiceId ?? routeServiceId ?? "";
  const { session } = useSession();
  const navigate = useNavigate();
  const location = useLocation() as ReturnType<typeof useLocation> & { state?: { adminFeedback?: string } | null };
  const heading = useRef<HTMLHeadingElement>(null);
  const detailQuery = useAdminServiceDetail(serviceId, session?.token ?? "", Boolean(session && serviceId));
  useEffect(() => { document.title = "Service Detail | Administrator"; heading.current?.focus(); }, []);
  const back = listPath(location.search);
  return <main id="main-content" className="admin-service-detail">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to={back}>Services</Link><span aria-hidden="true">/</span><span aria-current="page">Detail</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">Service record</span><h1 ref={heading} tabIndex={-1}>Service Detail</h1><p>Review Service metadata, Seller, and media.</p></div></header>
    {location.state?.adminFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{location.state.adminFeedback}</div> : null}
    {detailQuery.isPending && <div className="state-indicator" data-state="loading" role="status">Loading Service...</div>}
    {detailQuery.isError && <FailureMessage kind={kindOf(detailQuery.error)} action="load" onRetry={() => void detailQuery.refetch()} />}
    {detailQuery.data ? <div className="admin-service-detail-body">
      {detailQuery.data.imageUrl ? (
        <img src={detailQuery.data.imageUrl} alt="" className="admin-service-image-preview" loading="lazy" decoding="async" />
      ) : (
        <div className="state-indicator" data-state="empty" role="status">No image uploaded.</div>
      )}
      <dl>
        <dt>Title</dt><dd>{detailQuery.data.title}</dd>
        <dt>Short Description</dt><dd>{detailQuery.data.shortDescription || "Not provided"}</dd>
        <dt>Description</dt><dd>{detailQuery.data.description || "Not provided"}</dd>
        <dt>Price</dt><dd>${detailQuery.data.price}</dd>
        <dt>Rating</dt><dd>{detailQuery.data.rating.toFixed(1)} / 5</dd>
        <dt>Review Count</dt><dd>{detailQuery.data.reviewCount} (server-tracked, not editable)</dd>
        <dt>Seller</dt><dd>{detailQuery.data.sellerName ?? `User ${detailQuery.data.sellerId}`}</dd>
        <dt>Category</dt><dd>{detailQuery.data.categoryName ?? "Not available"}</dd>
        <dt>Group</dt><dd>{detailQuery.data.groupName ?? "Not available"}</dd>
        <dt>Subcategory</dt><dd>{detailQuery.data.subcategoryName ?? "Not available"}</dd>
      </dl>
      <nav className="detail-actions" aria-label="Service detail actions"><Link to={back}>Back to list</Link>
        <Link to={withSearch(`/admin/services/${serviceId}/edit`, location.search)}>Edit Service</Link>
        <DeleteServiceControl service={detailQuery.data} visibleLabel="Delete Service" className="danger-button"
          onReloadLatest={() => void detailQuery.refetch()} onDeleted={() => navigate(back, { replace: true, state: { adminFeedback: `Service ${detailQuery.data?.title ?? ""} deleted successfully.` } })} />
      </nav>
    </div> : null}
  </main>;
}
