import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { useAdminUserDetail } from "../controller";
import { DeleteUserControl } from "../components/delete-user-control";
import { FailureMessage, LegacyRoleWarning } from "../components/feedback";
import { kindOf, listPath, withSearch } from "../route-utils";

export function AdminUserDetailRoute({ userId: suppliedUserId }: { userId?: string } = {}) {
  const { userId: routeUserId } = useParams();
  const userId = suppliedUserId ?? routeUserId ?? "";
  const { session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  const detailQuery = useAdminUserDetail(userId, session?.token ?? "", Boolean(session && userId));
  useEffect(() => { document.title = "User Detail | Administrator"; heading.current?.focus(); }, []);
  const back = listPath(location.search);
  return <main id="main-content" className="admin-user-detail">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to={back}>Users</Link><span aria-hidden="true">/</span><span aria-current="page">Detail</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">User record</span><h1 ref={heading} tabIndex={-1}>User Detail</h1><p>Review profile information and account access.</p></div></header>
    {location.state?.adminFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{location.state.adminFeedback}</div> : null}
    {detailQuery.isPending && <div className="state-indicator" data-state="loading" role="status">Loading user...</div>}
    {detailQuery.isError && <FailureMessage kind={kindOf(detailQuery.error)} action="load" onRetry={() => void detailQuery.refetch()} />}
    {detailQuery.data ? <div className="user-detail"><LegacyRoleWarning role={detailQuery.data.role} /><dl>
      <dt>Name</dt><dd>{detailQuery.data.name}</dd><dt>Email</dt><dd>{detailQuery.data.email}</dd><dt>Phone</dt><dd>{detailQuery.data.phone || "Not provided"}</dd>
      <dt>Birthday</dt><dd>{detailQuery.data.birthday || "Not provided"}</dd><dt>Gender</dt><dd>{detailQuery.data.gender ? "Male" : "Female"}</dd>
      <dt>Role</dt><dd>{detailQuery.data.role || "Missing"}</dd><dt>Skills</dt><dd>{detailQuery.data.skills.length ? detailQuery.data.skills.join(", ") : "None"}</dd>
      <dt>Certifications</dt><dd>{detailQuery.data.certifications.length ? detailQuery.data.certifications.join(", ") : "None"}</dd></dl>
      <nav className="detail-actions" aria-label="User detail actions"><Link to={back}>Back to list</Link>
        <Link to={withSearch(`/admin/users/${userId}/edit`, location.search)}>Edit User</Link>
        <DeleteUserControl user={detailQuery.data} visibleLabel="Delete User" className="danger-button"
          onReloadLatest={() => void detailQuery.refetch()} onDeleted={() => navigate(back, { replace: true, state: { adminFeedback: `User ${detailQuery.data?.name ?? ""} deleted successfully.` } })} />
      </nav>
    </div> : null}
  </main>;
}
