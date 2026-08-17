import { useState } from "react";
import { useSession } from "../../authentication/public";
import { AdminCategoryManagementFailure, type AdminServiceCategory } from "../capability";
import { useAdminCategorySafeguardEvidence, useDeleteAdminCategory } from "../controller";
import { dependencySummary, sameCategoryEvidence, type GuardFeedback } from "../category-safeguards";
import { kindOf } from "../route-utils";
import { TypedCategoryDeleteDialog } from "./dialogs";
import { FailureMessage, GuardMessage } from "./feedback";

export function DeleteCategoryControl({ category, visibleLabel, className, onDeleted, onReloadLatest }: {
  category: AdminServiceCategory;
  visibleLabel: string;
  className?: string;
  onDeleted: () => void;
  onReloadLatest: () => void;
}) {
  const { session } = useSession();
  const mutation = useDeleteAdminCategory(session?.token ?? "");
  const evidence = useAdminCategorySafeguardEvidence(session?.token ?? "");
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [feedback, setFeedback] = useState<GuardFeedback | null>(null);
  const [checking, setChecking] = useState(false);

  const reset = () => {
    mutation.reset();
    setFeedback(null);
    setConfirmation("");
    setChecking(false);
  };

  const begin = () => {
    reset();
    if (!category.name.trim()) {
      setFeedback({ state: "blocked-dependency", message: "Delete is blocked because this Service Category has no trustworthy name for confirmation." });
      return;
    }
    setOpen(true);
  };

  const reconcileDelete = async () => {
    setChecking(true);
    try {
      const current = await evidence.refetchTarget(category.id);
      setFeedback({
        state: "unknown-outcome",
        message: `Delete was not confirmed. Service Category “${current.name}” still exists; no automatic retry was sent.`,
      });
    } catch (error) {
      if (error instanceof AdminCategoryManagementFailure && error.kind === "not_found") {
        onDeleted();
        return;
      }
      setFeedback({
        state: "unknown-outcome",
        message: "Delete outcome is still unknown because the latest Service Category could not be checked. No destructive retry was sent.",
      });
    } finally {
      setChecking(false);
    }
  };

  const confirm = async () => {
    setChecking(true);
    setFeedback(null);
    try {
      let current: AdminServiceCategory;
      let hierarchy;
      try {
        [current, hierarchy] = await Promise.all([
          evidence.refetchTarget(category.id),
          evidence.refetchHierarchy(category.id),
        ]);
      } catch (error) {
        if (error instanceof AdminCategoryManagementFailure && error.kind === "not_found") {
          setOpen(false);
          setFeedback({ state: "stale", message: "This Service Category no longer exists. Reload latest before taking another action." });
        } else {
          setOpen(false);
          setFeedback({
            state: "blocked-dependency",
            message: "Delete is blocked because the current Group/Subcategory dependencies could not be proven absent.",
          });
        }
        return;
      }

      if (!sameCategoryEvidence(current, category)) {
        setOpen(false);
        setFeedback({ state: "stale", message: "This Service Category changed after you opened it. Reload latest before deleting." });
        return;
      }

      const summary = dependencySummary(hierarchy);
      if (summary.hasDependencies) {
        setOpen(false);
        setFeedback({
          state: "blocked-dependency",
          message: `Delete is blocked because this Service Category still has ${summary.groupCount} Service Group${summary.groupCount === 1 ? "" : "s"} and ${summary.subcategoryCount} Service Subcategor${summary.subcategoryCount === 1 ? "y" : "ies"}. No cascade or reparenting is offered.`,
        });
        return;
      }

      try {
        await mutation.mutateAsync({ id: category.id });
        setOpen(false);
        onDeleted();
      } catch (error) {
        setOpen(false);
        if (kindOf(error) === "unknown_outcome") await reconcileDelete();
      }
    } finally {
      setChecking(false);
    }
  };

  return <>
    <button type="button" className={className} aria-label={`Delete ${category.name}`} onClick={begin}>{visibleLabel}</button>
    {feedback ? <GuardMessage feedback={feedback}
      onReload={feedback.state === "stale" ? () => { setFeedback(null); onReloadLatest(); } : undefined}
      onReconcile={feedback.state === "unknown-outcome" ? () => void reconcileDelete() : undefined} /> : null}
    {mutation.isError && kindOf(mutation.error) !== "unknown_outcome" ? <FailureMessage kind={kindOf(mutation.error)} action="delete" /> : null}
    {checking && !open ? <div className="state-indicator" data-state="pending" role="status">Checking latest Service Category...</div> : null}
    {open ? <TypedCategoryDeleteDialog categoryId={category.id} categoryName={category.name}
      pending={mutation.isPending || checking} confirmation={confirmation} onConfirmationChange={setConfirmation}
      onCancel={() => { setOpen(false); reset(); }} onConfirm={() => void confirm()} /> : null}
  </>;
}
