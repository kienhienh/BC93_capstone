import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { AdminSubcategoryManagementFailure, type AdminSubcategory } from "../capability";
import { SubcategoryForm } from "../components/subcategory-form";
import { DeleteSubcategoryControl } from "../components/delete-subcategory-control";
import { FailureMessage, GuardMessage } from "../components/feedback";
import { duplicateSubcategory, sameSubcategoryEvidence, type GuardFeedback } from "../subcategory-safeguards";
import { useAdminMembershipIndex, useAdminSubcategoryDetail, useAdminSubcategorySafeguardEvidence, useUpdateAdminSubcategory } from "../controller";
import { kindOf, listPath, withSearch } from "../route-utils";

export function AdminSubcategoryEditRoute() {
  const { subcategoryId = "" } = useParams();
  const { session } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const detailQuery = useAdminSubcategoryDetail(subcategoryId, session?.token ?? "", Boolean(subcategoryId));
  const membershipQuery = useAdminMembershipIndex(session?.token ?? "", Boolean(subcategoryId));
  const mutation = useUpdateAdminSubcategory(session?.token ?? "");
  const evidence = useAdminSubcategorySafeguardEvidence(session?.token ?? "");
  const [baselineOverride, setBaselineOverride] = useState<AdminSubcategory | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<GuardFeedback | null>(null);
  const [preflightFailure, setPreflightFailure] = useState<ReturnType<typeof kindOf> | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const back = listPath(location.search);

  useEffect(() => {
    document.title = "Edit Service Subcategory | Administrator";
    heading.current?.focus();
  }, []);
  const baseline = baselineOverride ?? detailQuery.data ?? null;
  const record = baseline && membershipQuery.data ? membershipQuery.data.get(baseline.id) ?? null : null;

  const reloadLatest = async () => {
    setFeedback(null);
    setNameError(null);
    const result = await detailQuery.refetch();
    await membershipQuery.refetch();
    if (result.data) {
      setBaselineOverride(result.data);
      setFormKey((value) => value + 1);
    }
  };

  const reconcileUpdate = async (name = pendingName) => {
    if (!baseline || !name) return;
    try {
      const current = await evidence.refetchTarget(baseline.id);
      if (current.name === name) {
        navigate(withSearch(`/admin/subcategories/${current.id}`, location.search), {
          replace: true,
          state: { adminFeedback: `Service Subcategory “${current.name}” update was confirmed after reconciliation.` },
        });
        return;
      }
      setFeedback({ state: "unknown-outcome", message: `Update was not confirmed. The latest Subcategory is still “${current.name}”; no automatic update retry was sent.` });
    } catch {
      setFeedback({ state: "unknown-outcome", message: "Update outcome is still unknown because the latest Subcategory could not be checked. No update retry was sent." });
    }
  };

  const save = async (name: string) => {
    if (!baseline) return false;
    setNameError(null);
    setFeedback(null);
    setPreflightFailure(null);
    setPendingName(name);

    try {
      const subcategories = await evidence.listAllSubcategories();
      if (duplicateSubcategory(subcategories, name, baseline.id)) {
        setNameError("A Service Subcategory with this name already exists.");
        queueMicrotask(() => document.getElementById("edit-subcategory-name")?.focus());
        return false;
      }
    } catch (error) {
      setPreflightFailure(kindOf(error));
      return false;
    }

    let current: AdminSubcategory;
    try {
      current = await evidence.refetchTarget(baseline.id);
    } catch (error) {
      if (error instanceof AdminSubcategoryManagementFailure && error.kind === "not_found") {
        setFeedback({ state: "stale", message: "This Service Subcategory no longer exists. Reload latest before editing." });
      } else {
        setFeedback({ state: "blocked-dependency", message: "Update is blocked until the latest Subcategory evidence can be verified." });
      }
      return false;
    }

    if (!sameSubcategoryEvidence(current, baseline)) {
      setFeedback({ state: "stale", message: "This Service Subcategory changed after you opened the form. Reload latest before saving." });
      return false;
    }

    try {
      const updated = await mutation.mutateAsync({ id: baseline.id, input: { name } });
      navigate(withSearch(`/admin/subcategories/${updated.id}`, location.search), {
        replace: true,
        state: { adminFeedback: `Service Subcategory “${updated.name}” updated successfully.` },
      });
      return true;
    } catch (error) {
      const kind = kindOf(error);
      if (kind === "validation") {
        setNameError("The server rejected this Service Subcategory name. Use a unique valid name.");
        queueMicrotask(() => document.getElementById("edit-subcategory-name")?.focus());
      } else if (kind === "unknown_outcome") {
        await reconcileUpdate(name);
      }
      return false;
    }
  };

  const pending = mutation.isPending;

  return <main id="main-content" className="admin-subcategory-edit">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to={back}>Service Subcategories</Link><span aria-hidden="true">/</span><span aria-current="page">Edit</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">Taxonomy maintenance</span><h1 ref={heading} tabIndex={-1}>Edit Service Subcategory</h1><p>Rename the Subcategory without changing its Service Group membership.</p></div></header>

    {detailQuery.isPending ? <div className="state-indicator" data-state="loading" role="status">Loading Service Subcategory...</div> : null}
    {detailQuery.isError ? <FailureMessage kind={kindOf(detailQuery.error)} action="load" onRetry={() => void detailQuery.refetch()} /> : null}
    {membershipQuery.isError && baseline ? <div className="state-indicator" data-state="blocked-dependency" role="alert">Current Service Group membership is unavailable. Deleting remains blocked until it can be verified.</div> : null}
    {record ? <p className="admin-subcategory-membership-note">Member of Service Group “{record.groupName}” under Service Category “{record.categoryName}”.</p> : null}
    {pending ? <div className="state-indicator" data-state="pending" role="status">Updating Service Subcategory...</div> : null}
    {preflightFailure ? <FailureMessage kind={preflightFailure} action="verify duplicate names for" /> : null}
    {mutation.isError && !["validation", "unknown_outcome"].includes(kindOf(mutation.error)) ? <FailureMessage kind={kindOf(mutation.error)} action="update" /> : null}
    {feedback ? <GuardMessage feedback={feedback}
      onReload={feedback.state === "stale" ? () => void reloadLatest() : undefined}
      onReconcile={feedback.state === "unknown-outcome" ? () => void reconcileUpdate() : undefined} /> : null}

    {baseline ? <>
      <SubcategoryForm key={`${baseline.id}-${formKey}`} initialName={baseline.name} pending={pending} submitLabel="Save Changes"
        idPrefix="edit-subcategory" cancelTo={back} serverNameError={nameError} onClearServerNameError={() => setNameError(null)} onSubmit={save} />
      <div className="admin-category-destructive-actions" aria-label="Edit Service Subcategory destructive actions">
        <DeleteSubcategoryControl subcategory={baseline} visibleLabel="Delete Subcategory" className="danger-button"
          onReloadLatest={() => void reloadLatest()}
          onDeleted={() => navigate(back, { replace: true, state: { adminFeedback: `Service Subcategory ${baseline.name} deleted successfully.` } })} />
      </div>
    </> : null}
  </main>;
}
