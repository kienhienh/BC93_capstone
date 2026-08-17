import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { GroupMembershipForm } from "../components/group-membership-form";
import { FailureMessage, GuardMessage } from "../components/feedback";
import { duplicateGroupName, foreignMemberships, type GuardFeedback } from "../subcategory-safeguards";
import {
  useAdminAllSubcategories,
  useAdminCategoryHierarchy,
  useAdminMembershipIndex,
  useAdminSubcategorySafeguardEvidence,
  useCreateAdminGroup,
} from "../controller";
import { kindOf } from "../route-utils";

export function AdminGroupCreateRoute() {
  const { categoryId = "" } = useParams();
  const { session } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const token = session?.token ?? "";
  const hierarchyQuery = useAdminCategoryHierarchy(categoryId, token, Boolean(categoryId));
  const subcategoriesQuery = useAdminAllSubcategories(token, Boolean(categoryId));
  const membershipQuery = useAdminMembershipIndex(token, Boolean(categoryId));
  const mutation = useCreateAdminGroup(token);
  const evidence = useAdminSubcategorySafeguardEvidence(token);
  const [nameError, setNameError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<GuardFeedback | null>(null);
  const [pending, setPending] = useState<{ name: string; ids: readonly string[] } | null>(null);
  const back = `/admin/categories/${categoryId}${location.search}`;

  useEffect(() => {
    document.title = "Add Service Group | Administrator";
    heading.current?.focus();
  }, []);

  const reconcileCreate = async (target = pending) => {
    if (!target) return;
    try {
      const fresh = await evidence.refetchCategoryHierarchy(categoryId);
      const existingIds = new Set(hierarchyQuery.data?.groups.map((group) => group.id) ?? []);
      const created = fresh.groups.find((group) => !existingIds.has(group.id) && group.name === target.name);
      if (created) {
        navigate(back, { replace: true, state: { adminFeedback: `Service Group “${created.name}” was confirmed after reconciliation.` } });
        return;
      }
      setFeedback({
        state: "unknown-outcome",
        message: `Create was not confirmed. No new Service Group named “${target.name}” is visible yet; no automatic retry was sent.`,
      });
    } catch {
      setFeedback({ state: "unknown-outcome", message: "Create outcome is still unknown because the latest Service Category relationships could not be checked. No create retry was sent." });
    }
  };

  const save = async (name: string, subcategoryIds: readonly string[]) => {
    if (!hierarchyQuery.data) return false;
    setNameError(null);
    setFeedback(null);
    setPending({ name, ids: subcategoryIds });

    if (duplicateGroupName(hierarchyQuery.data, name)) {
      setNameError("A Service Group with this name already exists in this Service Category.");
      return false;
    }

    let freshHierarchy;
    let freshMembership;
    try {
      [freshHierarchy, freshMembership] = await Promise.all([
        evidence.refetchCategoryHierarchy(categoryId),
        evidence.refetchMembershipIndex(),
      ]);
    } catch {
      setFeedback({ state: "blocked-dependency", message: "Create is blocked until the latest Service Category relationships can be verified." });
      return false;
    }

    if (duplicateGroupName(freshHierarchy, name)) {
      setNameError("A Service Group with this name already exists in this Service Category.");
      return false;
    }

    const conflicts = foreignMemberships(subcategoryIds, freshMembership, null);
    if (conflicts.length) {
      setFeedback({
        state: "blocked-dependency",
        message: `Create is blocked because ${conflicts.length === 1 ? "one Service Subcategory is" : `${conflicts.length} Service Subcategories are`} already a member of another Service Group. Remove them there first.`,
      });
      return false;
    }

    try {
      await mutation.mutateAsync({ name, categoryId, subcategoryIds });
      await reconcileCreate({ name, ids: subcategoryIds });
      return true;
    } catch (error) {
      const kind = kindOf(error);
      if (kind === "validation") {
        setNameError("The server rejected this Service Group name or membership. Use a unique valid name and available Subcategories.");
      } else if (kind === "unknown_outcome") {
        await reconcileCreate({ name, ids: subcategoryIds });
      }
      return false;
    }
  };

  return <main id="main-content" className="admin-group-create">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to="/admin/categories">Service Categories</Link><span aria-hidden="true">/</span><Link to={back}>{hierarchyQuery.data?.categoryName ?? "Detail"}</Link><span aria-hidden="true">/</span><span aria-current="page">Add Service Group</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">New taxonomy container</span><h1 ref={heading} tabIndex={-1}>Add Service Group</h1><p>Create a Service Group and assign its initial Service Subcategory membership.</p></div></header>

    {hierarchyQuery.isPending ? <div className="state-indicator" data-state="loading" role="status">Loading Service Category relationships...</div> : null}
    {hierarchyQuery.isError ? <FailureMessage kind={kindOf(hierarchyQuery.error)} action="load" onRetry={() => void hierarchyQuery.refetch()} /> : null}
    {subcategoriesQuery.isError ? <FailureMessage kind={kindOf(subcategoriesQuery.error)} action="load Service Subcategories for" onRetry={() => void subcategoriesQuery.refetch()} /> : null}
    {membershipQuery.isError ? <FailureMessage kind={kindOf(membershipQuery.error)} action="verify Service Group membership for" onRetry={() => void membershipQuery.refetch()} /> : null}
    {mutation.isPending ? <div className="state-indicator" data-state="pending" role="status">Saving Service Group...</div> : null}
    {feedback ? <GuardMessage feedback={feedback} onReconcile={feedback.state === "unknown-outcome" ? () => void reconcileCreate() : undefined} /> : null}

    {hierarchyQuery.data && subcategoriesQuery.data && membershipQuery.data ? <GroupMembershipForm
      idPrefix="create-group" categoryName={hierarchyQuery.data.categoryName} initialGroupName=""
      allSubcategories={subcategoriesQuery.data} initialSelectedIds={[]} ownGroupId={null}
      membershipIndex={membershipQuery.data} pending={mutation.isPending} submitLabel="Review Group"
      cancelTo={back} serverNameError={nameError} onClearServerNameError={() => setNameError(null)} onSubmit={save} /> : null}
  </main>;
}
