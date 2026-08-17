import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { CategoryForm } from "../components/category-form";
import { FailureMessage, GuardMessage } from "../components/feedback";
import { duplicateCategory, type GuardFeedback } from "../category-safeguards";
import { useAdminCategorySafeguardEvidence, useCreateAdminCategory } from "../controller";
import { kindOf, listPath } from "../route-utils";

export function AdminCategoryCreateRoute() {
  const { session } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const mutation = useCreateAdminCategory(session?.token ?? "");
  const evidence = useAdminCategorySafeguardEvidence(session?.token ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [preflightFailure, setPreflightFailure] = useState<ReturnType<typeof kindOf> | null>(null);
  const [feedback, setFeedback] = useState<GuardFeedback | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const back = listPath(location.search);

  useEffect(() => {
    document.title = "Create Service Category | Administrator";
    heading.current?.focus();
  }, []);

  const reconcileCreate = async (name = pendingName) => {
    if (!name) return;
    try {
      const categories = await evidence.listAllCategories();
      const matches = categories.filter((category) => category.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      if (matches.length === 1) {
        navigate(`/admin/categories/${matches[0].id}${location.search}`, {
          replace: true,
          state: { adminFeedback: `Service Category “${matches[0].name}” was confirmed after reconciliation.` },
        });
        return;
      }
      setFeedback({
        state: "unknown-outcome",
        message: matches.length > 1
          ? "Create outcome is ambiguous because more than one matching Category exists. No create retry was sent."
          : "Create outcome is still unknown. No matching Category is currently visible and no create retry was sent.",
      });
    } catch {
      setFeedback({ state: "unknown-outcome", message: "Create outcome is still unknown because the latest Category list could not be checked. No create retry was sent." });
    }
  };

  const save = async (name: string) => {
    setNameError(null);
    setPreflightFailure(null);
    setFeedback(null);
    setPendingName(name);
    try {
      const categories = await evidence.listAllCategories();
      if (duplicateCategory(categories, name)) {
        setNameError("A Service Category with this name already exists.");
        queueMicrotask(() => document.getElementById("create-category-name")?.focus());
        return false;
      }
    } catch (error) {
      setPreflightFailure(kindOf(error));
      return false;
    }

    try {
      const created = await mutation.mutateAsync({ name });
      navigate(back, { replace: true, state: { adminFeedback: `Service Category “${created.name}” created successfully.` } });
      return true;
    } catch (error) {
      const kind = kindOf(error);
      if (kind === "validation") {
        setNameError("The server rejected this Service Category name. Use a unique valid name.");
        queueMicrotask(() => document.getElementById("create-category-name")?.focus());
      } else if (kind === "unknown_outcome") {
        await reconcileCreate(name);
      }
      return false;
    }
  };

  return <main id="main-content" className="admin-category-create">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to={back}>Service Categories</Link><span aria-hidden="true">/</span><span aria-current="page">Create</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">New taxonomy record</span><h1 ref={heading} tabIndex={-1}>Create Service Category</h1><p>Create one top-level Category. Group and Subcategory membership is outside this workflow.</p></div></header>
    {mutation.isPending ? <div className="state-indicator" data-state="pending" role="status">Creating Service Category...</div> : null}
    {preflightFailure ? <FailureMessage kind={preflightFailure} action="verify duplicate names for" /> : null}
    {mutation.isError && !["validation", "unknown_outcome"].includes(kindOf(mutation.error)) ? <FailureMessage kind={kindOf(mutation.error)} action="create" /> : null}
    {feedback ? <GuardMessage feedback={feedback} onReconcile={feedback.state === "unknown-outcome" ? () => void reconcileCreate() : undefined} /> : null}
    <CategoryForm initialName="" pending={mutation.isPending} submitLabel="Create Category" idPrefix="create-category" cancelTo={back}
      serverNameError={nameError} onClearServerNameError={() => setNameError(null)} onSubmit={save} />
  </main>;
}
