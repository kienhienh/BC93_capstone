import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { DeleteSubcategoryControl } from "../components/delete-subcategory-control";
import { FailureMessage } from "../components/feedback";
import { useAdminMembershipIndex, useAdminSubcategoryDetail } from "../controller";
import { kindOf, listPath, withSearch } from "../route-utils";

export function AdminSubcategoryDetailRoute() {
  const { subcategoryId = "" } = useParams();
  const { session } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const detailQuery = useAdminSubcategoryDetail(subcategoryId, session?.token ?? "", Boolean(subcategoryId));
  const membershipQuery = useAdminMembershipIndex(session?.token ?? "", Boolean(subcategoryId));
  const back = listPath(location.search);

  useEffect(() => {
    document.title = "Service Subcategory Detail | Administrator";
    heading.current?.focus();
  }, []);

  const subcategory = detailQuery.data;
  const record = subcategory && membershipQuery.data ? membershipQuery.data.get(subcategory.id) ?? null : null;

  return <main id="main-content" className="admin-subcategory-detail">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to={back}>Service Subcategories</Link><span aria-hidden="true">/</span><span aria-current="page">Detail</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">Taxonomy leaf</span><h1 ref={heading} tabIndex={-1}>Service Subcategory Detail</h1><p>Review the Subcategory and where it is currently a member of a Service Group.</p></div></header>

    {detailQuery.isPending ? <div className="state-indicator" data-state="loading" role="status">Loading Service Subcategory...</div> : null}
    {detailQuery.isRefetching && !detailQuery.isPending ? <div className="state-indicator" data-state="refreshing" role="status">Refreshing Service Subcategory...</div> : null}
    {detailQuery.isError ? <FailureMessage kind={kindOf(detailQuery.error)} action="load" onRetry={() => void detailQuery.refetch()} /> : null}

    {subcategory ? <>
      <section className="admin-subcategory-detail-card" aria-labelledby="subcategory-record-title">
        <span className="admin-eyebrow">Service Subcategory</span><h2 id="subcategory-record-title">{subcategory.name}</h2><p>Identifier: {subcategory.id}</p>
      </section>

      <section className="admin-category-hierarchy" aria-labelledby="subcategory-membership-title">
        <div className="admin-category-section-heading"><div><span className="admin-eyebrow">Known relationship</span><h2 id="subcategory-membership-title">Service Group membership</h2></div></div>
        {membershipQuery.isPending ? <div className="state-indicator" data-state="loading" role="status">Loading Service Group membership...</div> : null}
        {membershipQuery.isError ? <div className="state-indicator" data-state="blocked-dependency" role="alert">
          <span>Current Service Group membership could not be verified. Destructive deletion remains blocked.</span>
          <button type="button" className="state-retry" onClick={() => void membershipQuery.refetch()}>Try relationships again</button>
        </div> : null}
        {membershipQuery.data && !record ? <p className="admin-subcategory-membership-note">Not currently assigned to any Service Group.</p> : null}
        {record ? <p className="admin-subcategory-membership-note">
          Member of Service Group “{record.groupName}” under Service Category “{record.categoryName}”.
        </p> : null}
      </section>

      <nav className="detail-actions" aria-label="Service Subcategory detail actions">
        <Link to={back}>Back to list</Link>
        <Link to={withSearch(`/admin/subcategories/${subcategory.id}/edit`, location.search)}>Edit Subcategory</Link>
        <DeleteSubcategoryControl subcategory={subcategory} visibleLabel="Delete Subcategory" className="danger-button"
          onReloadLatest={() => { void detailQuery.refetch(); void membershipQuery.refetch(); }}
          onDeleted={() => navigate(back, { replace: true, state: { adminFeedback: `Service Subcategory ${subcategory.name} deleted successfully.` } })} />
      </nav>
    </> : null}
  </main>;
}
