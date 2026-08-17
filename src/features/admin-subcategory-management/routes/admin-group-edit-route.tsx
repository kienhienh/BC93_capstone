import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { GroupMembershipForm } from "../components/group-membership-form";
import { FailureMessage, GuardMessage } from "../components/feedback";
import { duplicateGroupName, foreignMemberships, sameGroupEvidence, type GuardFeedback } from "../subcategory-safeguards";
import {
  useAdminAllSubcategories,
  useAdminCategoryHierarchy,
  useAdminMembershipIndex,
  useAdminSubcategorySafeguardEvidence,
  useUpdateAdminGroup,
} from "../controller";
import { kindOf } from "../route-utils";
import type { AdminServiceGroup } from "../capability";

export function AdminGroupEditRoute() {
  const { categoryId = "", groupId = "" } = useParams();
  const { session } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const token = session?.token ?? "";
  const hierarchyQuery = useAdminCategoryHierarchy(categoryId, token, Boolean(categoryId));
  const subcategoriesQuery = useAdminAllSubcategories(token, Boolean(categoryId));
  const membershipQuery = useAdminMembershipIndex(token, Boolean(categoryId));
  const mutation = useUpdateAdminGroup(token);
  const evidence = useAdminSubcategorySafeguardEvidence(token);
  const [baselineOverride, setBaselineOverride] = useState<AdminServiceGroup | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<GuardFeedback | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [pending, setPending] = useState<{ name: string; ids: readonly string[] } | null>(null);
  const back = `/admin/categories/${categoryId}${location.search}`;

  useEffect(() => {
    document.title = "Edit Service Group | Administrator";
    heading.current?.focus();
  }, []);

  const baseline = baselineOverride ?? hierarchyQuery.data?.groups.find((group) => group.id === groupId) ?? null;
  const notFound = Boolean(hierarchyQuery.data) && !baselineOverride && !hierarchyQuery.data?.groups.some((group) => group.id === groupId);

  const reloadLatest = async () => {
    setFeedback(null);
    setNameError(null);
    const result = await hierarchyQuery.refetch();
    await membershipQuery.refetch();
    const refreshed = result.data?.groups.find((group) => group.id === groupId) ?? null;
    setBaselineOverride(refreshed);
    setFormKey((value) => value + 1);
  };

  const reconcileUpdate = async (target = pending) => {
    if (!target) return;
    try {
      const fresh = await evidence.refetchCategoryHierarchy(categoryId);
      const current = fresh.groups.find((group) => group.id === groupId);
      const memberIds = current ? [...current.subcategories.map((item) => item.id)].sort() : [];
      const expectedIds = [...target.ids].sort();
      const matches = current && current.name === target.name && memberIds.length === expectedIds.length
        && memberIds.every((id, index) => id === expectedIds[index]);
      if (matches) {
        navigate(back, { replace: true, state: { adminFeedback: `Service Group “${current.name}” update was confirmed after reconciliation.` } });
        return;
      }
      setFeedback({ state: "unknown-outcome", message: "Update was not confirmed. The latest Service Group membership does not yet match; no automatic retry was sent." });
    } catch {
      setFeedback({ state: "unknown-outcome", message: "Update outcome is still unknown because the latest Service Category relationships could not be checked. No update retry was sent." });
    }
  };

  const save = async (name: string, subcategoryIds: readonly string[]) => {
    if (!baseline || !hierarchyQuery.data) return false;
    setNameError(null);
    setFeedback(null);
    setPending({ name, ids: subcategoryIds });

    if (duplicateGroupName(hierarchyQuery.data, name, baseline.id)) {
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
      setFeedback({ state: "blocked-dependency", message: "Update is blocked until the latest Service Category relationships can be verified." });
      return false;
    }

    const current = freshHierarchy.groups.find((group) => group.id === groupId);
    if (!current) {
      setFeedback({ state: "stale", message: "This Service Group no longer exists. Reload latest before editing." });
      return false;
    }
    if (!sameGroupEvidence(current, baseline)) {
      setFeedback({ state: "stale", message: "This Service Group changed after you opened the form. Reload latest before saving." });
      return false;
    }
    if (duplicateGroupName(freshHierarchy, name, baseline.id)) {
      setNameError("A Service Group with this name already exists in this Service Category.");
      return false;
    }

    const conflicts = foreignMemberships(subcategoryIds, freshMembership, groupId);
    if (conflicts.length) {
      setFeedback({
        state: "blocked-dependency",
        message: `Update is blocked because ${conflicts.length === 1 ? "one Service Subcategory is" : `${conflicts.length} Service Subcategories are`} already a member of another Service Group. Remove them there first.`,
      });
      return false;
    }

    try {
      await mutation.mutateAsync({ groupId, input: { name, categoryId, subcategoryIds } });
      await reconcileUpdate({ name, ids: subcategoryIds });
      return true;
    } catch (error) {
      const kind = kindOf(error);
      if (kind === "validation") {
        setNameError("The server rejected this Service Group name or membership. Use a unique valid name and available Subcategories.");
      } else if (kind === "unknown_outcome") {
        await reconcileUpdate({ name, ids: subcategoryIds });
      }
      return false;
    }
  };

  return <main id="main-content" className="admin-group-edit">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to="/admin/categories">Service Categories</Link><span aria-hidden="true">/</span><Link to={back}>{hierarchyQuery.data?.categoryName ?? "Detail"}</Link><span aria-hidden="true">/</span><span aria-current="page">Edit Service Group</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">Taxonomy maintenance</span><h1 ref={heading} tabIndex={-1}>Edit Service Group</h1><p>Rename the Service Group or change which Service Subcategories belong to it.</p></div></header>

    {hierarchyQuery.isPending ? <div className="state-indicator" data-state="loading" role="status">Loading Service Category relationships...</div> : null}
    {hierarchyQuery.isError ? <FailureMessage kind={kindOf(hierarchyQuery.error)} action="load" onRetry={() => void hierarchyQuery.refetch()} /> : null}
    {notFound ? <div className="state-indicator" data-state="stale" role="alert"><span>This Service Group no longer exists in the latest relationships.</span></div> : null}
    {subcategoriesQuery.isError ? <FailureMessage kind={kindOf(subcategoriesQuery.error)} action="load Service Subcategories for" onRetry={() => void subcategoriesQuery.refetch()} /> : null}
    {membershipQuery.isError ? <FailureMessage kind={kindOf(membershipQuery.error)} action="verify Service Group membership for" onRetry={() => void membershipQuery.refetch()} /> : null}
    {mutation.isPending ? <div className="state-indicator" data-state="pending" role="status">Saving Service Group...</div> : null}
    {feedback ? <GuardMessage feedback={feedback}
      onReload={feedback.state === "stale" ? () => void reloadLatest() : undefined}
      onReconcile={feedback.state === "unknown-outcome" ? () => void reconcileUpdate() : undefined} /> : null}

    {baseline && hierarchyQuery.data && subcategoriesQuery.data && membershipQuery.data ? <GroupMembershipForm
      key={`${baseline.id}-${formKey}`} idPrefix="edit-group" categoryName={hierarchyQuery.data.categoryName} initialGroupName={baseline.name}
      allSubcategories={subcategoriesQuery.data} initialSelectedIds={baseline.subcategories.map((item) => item.id)} ownGroupId={baseline.id}
      membershipIndex={membershipQuery.data} pending={mutation.isPending} submitLabel="Review changes"
      cancelTo={back} serverNameError={nameError} onClearServerNameError={() => setNameError(null)} onSubmit={save} /> : null}
  </main>;
}
