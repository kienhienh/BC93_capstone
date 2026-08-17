import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { AdminCategoryManagementFailure, type AdminServiceCategory } from "../capability";
import { CategoryForm } from "../components/category-form";
import { DeleteCategoryControl } from "../components/delete-category-control";
import { FailureMessage, GuardMessage } from "../components/feedback";
import { categoryMatchesName, dependencySummary, duplicateCategory, sameCategoryEvidence, type GuardFeedback } from "../category-safeguards";
import { useAdminCategoryDetail, useAdminCategoryHierarchy, useAdminCategorySafeguardEvidence, useUpdateAdminCategory } from "../controller";
import { kindOf, listPath, withSearch } from "../route-utils";

export function AdminCategoryEditRoute() {
  const { categoryId = "" } = useParams();
  const { session } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const detailQuery = useAdminCategoryDetail(categoryId, session?.token ?? "", Boolean(categoryId));
  const hierarchyQuery = useAdminCategoryHierarchy(categoryId, session?.token ?? "", Boolean(categoryId));
  const mutation = useUpdateAdminCategory(session?.token ?? "");
  const evidence = useAdminCategorySafeguardEvidence(session?.token ?? "");
  const [baselineOverride, setBaselineOverride] = useState<AdminServiceCategory | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<GuardFeedback | null>(null);
  const [preflightFailure, setPreflightFailure] = useState<ReturnType<typeof kindOf> | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const back = listPath(location.search);

  useEffect(() => {
    document.title = "Edit Service Category | Administrator";
    heading.current?.focus();
  }, []);
  const baseline = baselineOverride ?? detailQuery.data ?? null;

  const reloadLatest = async () => {
    setFeedback(null);
    setNameError(null);
    const result = await detailQuery.refetch();
    await hierarchyQuery.refetch();
    if (result.data) {
      setBaselineOverride(result.data);
      setFormKey((value) => value + 1);
    }
  };

  const reconcileUpdate = async (name = pendingName) => {
    if (!baseline || !name) return;
    try {
      const current = await evidence.refetchTarget(baseline.id);
      if (categoryMatchesName(current, name)) {
        navigate(withSearch(`/admin/categories/${current.id}`, location.search), {
          replace: true,
          state: { adminFeedback: `Service Category “${current.name}” update was confirmed after reconciliation.` },
        });
        return;
      }
      setFeedback({ state: "unknown-outcome", message: `Update was not confirmed. The latest Category is still “${current.name}”; no automatic update retry was sent.` });
    } catch {
      setFeedback({ state: "unknown-outcome", message: "Update outcome is still unknown because the latest Category could not be checked. No update retry was sent." });
    }
  };

  const save = async (name: string) => {
    if (!baseline) return false;
    setNameError(null);
    setFeedback(null);
    setPreflightFailure(null);
    setPendingName(name);

    try {
      const categories = await evidence.listAllCategories();
      if (duplicateCategory(categories, name, baseline.id)) {
        setNameError("A Service Category with this name already exists.");
        queueMicrotask(() => document.getElementById("edit-category-name")?.focus());
        return false;
      }
    } catch (error) {
      setPreflightFailure(kindOf(error));
      return false;
    }

    let current: AdminServiceCategory;
    try {
      [current] = await Promise.all([
        evidence.refetchTarget(baseline.id),
        evidence.refetchHierarchy(baseline.id),
      ]);
    } catch (error) {
      if (error instanceof AdminCategoryManagementFailure && error.kind === "not_found") {
        setFeedback({ state: "stale", message: "This Service Category no longer exists. Reload latest before editing." });
      } else {
        setFeedback({ state: "blocked-dependency", message: "Update is blocked until the latest Group/Subcategory relationships can be verified." });
      }
      return false;
    }

    if (!sameCategoryEvidence(current, baseline)) {
      setFeedback({ state: "stale", message: "This Service Category changed after you opened the form. Reload latest before saving." });
      return false;
    }

    try {
      const updated = await mutation.mutateAsync({ id: baseline.id, input: { name } });
      navigate(withSearch(`/admin/categories/${updated.id}`, location.search), {
        replace: true,
        state: { adminFeedback: `Service Category “${updated.name}” updated successfully.` },
      });
      return true;
    } catch (error) {
      const kind = kindOf(error);
      if (kind === "validation") {
        setNameError("The server rejected this Service Category name. Use a unique valid name.");
        queueMicrotask(() => document.getElementById("edit-category-name")?.focus());
      } else if (kind === "unknown_outcome") {
        await reconcileUpdate(name);
      }
      return false;
    }
  };

  const summary = hierarchyQuery.data ? dependencySummary(hierarchyQuery.data) : null;
  const pending = mutation.isPending;

  return <main id="main-content" className="admin-category-edit">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to={back}>Service Categories</Link><span aria-hidden="true">/</span><span aria-current="page">Edit</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">Taxonomy maintenance</span><h1 ref={heading} tabIndex={-1}>Edit Service Category</h1><p>Rename the Category without changing its Group or Subcategory membership.</p></div></header>

    {detailQuery.isPending ? <div className="state-indicator" data-state="loading" role="status">Loading Service Category...</div> : null}
    {detailQuery.isError ? <FailureMessage kind={kindOf(detailQuery.error)} action="load" onRetry={() => void detailQuery.refetch()} /> : null}
    {hierarchyQuery.isError && baseline ? <div className="state-indicator" data-state="blocked-dependency" role="alert">Current relationships are unavailable. Saving and deleting remain blocked until they can be verified.</div> : null}
    {summary ? <p className="admin-category-relationship-note">Current read-only hierarchy: {summary.groupCount} Service Groups and {summary.subcategoryCount} Service Subcategories.</p> : null}
    {pending ? <div className="state-indicator" data-state="pending" role="status">Updating Service Category...</div> : null}
    {preflightFailure ? <FailureMessage kind={preflightFailure} action="verify duplicate names for" /> : null}
    {mutation.isError && !["validation", "unknown_outcome"].includes(kindOf(mutation.error)) ? <FailureMessage kind={kindOf(mutation.error)} action="update" /> : null}
    {feedback ? <GuardMessage feedback={feedback}
      onReload={feedback.state === "stale" ? () => void reloadLatest() : undefined}
      onReconcile={feedback.state === "unknown-outcome" ? () => void reconcileUpdate() : undefined} /> : null}

    {baseline ? <>
      <CategoryForm key={`${baseline.id}-${formKey}`} initialName={baseline.name} pending={pending} submitLabel="Save Changes"
        idPrefix="edit-category" cancelTo={back} serverNameError={nameError} onClearServerNameError={() => setNameError(null)} onSubmit={save} />
      <div className="admin-category-destructive-actions" aria-label="Edit Service Category destructive actions">
        <DeleteCategoryControl category={baseline} visibleLabel="Delete Category" className="danger-button"
          onReloadLatest={() => void reloadLatest()}
          onDeleted={() => navigate(back, { replace: true, state: { adminFeedback: `Service Category ${baseline.name} deleted successfully.` } })} />
      </div>
    </> : null}
  </main>;
}
