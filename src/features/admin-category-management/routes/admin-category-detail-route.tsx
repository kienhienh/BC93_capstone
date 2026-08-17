import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { DeleteCategoryControl } from "../components/delete-category-control";
import { FailureMessage } from "../components/feedback";
import { useAdminCategoryDetail, useAdminCategoryHierarchy } from "../controller";
import { dependencySummary } from "../category-safeguards";
import { kindOf, listPath, withSearch } from "../route-utils";

export function AdminCategoryDetailRoute() {
  const { categoryId = "" } = useParams();
  const { session } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const detailQuery = useAdminCategoryDetail(categoryId, session?.token ?? "", Boolean(categoryId));
  const hierarchyQuery = useAdminCategoryHierarchy(categoryId, session?.token ?? "", Boolean(categoryId));
  const back = listPath(location.search);

  useEffect(() => {
    document.title = "Service Category Detail | Administrator";
    heading.current?.focus();
  }, []);

  const category = detailQuery.data;
  const relationshipSummary = hierarchyQuery.data ? dependencySummary(hierarchyQuery.data) : null;

  return <main id="main-content" className="admin-category-detail">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to={back}>Service Categories</Link><span aria-hidden="true">/</span><span aria-current="page">Detail</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">Taxonomy record</span><h1 ref={heading} tabIndex={-1}>Service Category Detail</h1><p>Review the Category and the Group/Subcategory relationships currently reported by the API.</p></div></header>

    {detailQuery.isPending ? <div className="state-indicator" data-state="loading" role="status">Loading Service Category...</div> : null}
    {detailQuery.isRefetching && !detailQuery.isPending ? <div className="state-indicator" data-state="refreshing" role="status">Refreshing Service Category...</div> : null}
    {detailQuery.isError ? <FailureMessage kind={kindOf(detailQuery.error)} action="load" onRetry={() => void detailQuery.refetch()} /> : null}

    {category ? <>
      <section className="admin-category-detail-card" aria-labelledby="category-record-title">
        <div><span className="admin-category-avatar admin-category-avatar-large" aria-hidden="true">{category.name.charAt(0).toUpperCase()}</span></div>
        <div><span className="admin-eyebrow">Service Category</span><h2 id="category-record-title">{category.name}</h2><p>Identifier: {category.id}</p></div>
      </section>

      <section className="admin-category-hierarchy" aria-labelledby="category-hierarchy-title">
        <div className="admin-category-section-heading"><div><span className="admin-eyebrow">Known relationships</span><h2 id="category-hierarchy-title">Service Groups and Subcategories</h2></div>
          {relationshipSummary ? <span>{relationshipSummary.groupCount} Groups · {relationshipSummary.subcategoryCount} Subcategories</span> : null}</div>
        {hierarchyQuery.isPending ? <div className="state-indicator" data-state="loading" role="status">Loading Category relationships...</div> : null}
        {hierarchyQuery.isRefetching && !hierarchyQuery.isPending ? <div className="state-indicator" data-state="refreshing" role="status">Refreshing Category relationships...</div> : null}
        {hierarchyQuery.isError ? <div className="state-indicator" data-state="blocked-dependency" role="alert">
          <span>Current Group/Subcategory relationships could not be verified. Destructive deletion remains blocked.</span>
          <button type="button" className="state-retry" onClick={() => void hierarchyQuery.refetch()}>Try relationships again</button>
        </div> : null}
        {hierarchyQuery.data && hierarchyQuery.data.groups.length === 0 ? <div className="state-indicator" data-state="empty" role="status">No Service Groups are currently reported for this Category.</div> : null}
        {hierarchyQuery.data?.groups.map((group) => <article key={group.id} className="admin-category-group">
          <header><div><h3>{group.name}</h3><small>Group ID {group.id}</small></div>{group.imageUrl ? <img src={group.imageUrl} alt="" /> : null}</header>
          {group.subcategories.length ? <ul aria-label={`${group.name} Service Subcategories`}>
            {group.subcategories.map((subcategory) => <li key={subcategory.id}><span>{subcategory.name}</span><small>ID {subcategory.id}</small></li>)}
          </ul> : <p className="admin-category-no-children">No Service Subcategories are currently reported for this Group.</p>}
        </article>)}
      </section>

      <nav className="detail-actions" aria-label="Service Category detail actions">
        <Link to={back}>Back to list</Link>
        <Link to={withSearch(`/admin/categories/${category.id}/edit`, location.search)}>Edit Category</Link>
        <DeleteCategoryControl category={category} visibleLabel="Delete Category" className="danger-button"
          onReloadLatest={() => { void detailQuery.refetch(); void hierarchyQuery.refetch(); }}
          onDeleted={() => navigate(back, { replace: true, state: { adminFeedback: `Service Category ${category.name} deleted successfully.` } })} />
      </nav>
    </> : null}
  </main>;
}
