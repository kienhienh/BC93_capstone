import { useState } from "react";
import { useSession } from "../../authentication/public";
import { AdminSubcategoryManagementFailure, type AdminSubcategory } from "../capability";
import { useAdminSubcategorySafeguardEvidence, useDeleteAdminSubcategory } from "../controller";
import { sameSubcategoryEvidence, type GuardFeedback } from "../subcategory-safeguards";
import { kindOf } from "../route-utils";
import { TypedSubcategoryDeleteDialog } from "./dialogs";
import { FailureMessage, GuardMessage } from "./feedback";

export function DeleteSubcategoryControl({ subcategory, visibleLabel, className, onDeleted, onReloadLatest }: {
  subcategory: AdminSubcategory;
  visibleLabel: string;
  className?: string;
  onDeleted: () => void;
  onReloadLatest: () => void;
}) {
  const { session } = useSession();
  const mutation = useDeleteAdminSubcategory(session?.token ?? "");
  const evidence = useAdminSubcategorySafeguardEvidence(session?.token ?? "");
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
    if (!subcategory.name.trim()) {
      setFeedback({ state: "blocked-dependency", message: "Delete is blocked because this Service Subcategory has no trustworthy name for confirmation." });
      return;
    }
    setOpen(true);
  };

  const reconcileDelete = async () => {
    setChecking(true);
    try {
      const current = await evidence.refetchTarget(subcategory.id);
      setFeedback({
        state: "unknown-outcome",
        message: `Delete was not confirmed. Service Subcategory “${current.name}” still exists; no automatic retry was sent.`,
      });
    } catch (error) {
      if (error instanceof AdminSubcategoryManagementFailure && error.kind === "not_found") {
        onDeleted();
        return;
      }
      setFeedback({
        state: "unknown-outcome",
        message: "Delete outcome is still unknown because the latest Service Subcategory could not be checked. No destructive retry was sent.",
      });
    } finally {
      setChecking(false);
    }
  };

  const confirm = async () => {
    setChecking(true);
    setFeedback(null);
    try {
      let current: AdminSubcategory;
      let membership;
      try {
        [current, membership] = await Promise.all([
          evidence.refetchTarget(subcategory.id),
          evidence.refetchMembershipIndex(),
        ]);
      } catch (error) {
        if (error instanceof AdminSubcategoryManagementFailure && error.kind === "not_found") {
          setOpen(false);
          setFeedback({ state: "stale", message: "This Service Subcategory no longer exists. Reload latest before taking another action." });
        } else {
          setOpen(false);
          setFeedback({
            state: "blocked-dependency",
            message: "Delete is blocked because current Service Group membership could not be proven absent.",
          });
        }
        return;
      }

      if (!sameSubcategoryEvidence(current, subcategory)) {
        setOpen(false);
        setFeedback({ state: "stale", message: "This Service Subcategory changed after you opened it. Reload latest before deleting." });
        return;
      }

      const record = membership.get(subcategory.id);
      if (record) {
        setOpen(false);
        setFeedback({
          state: "blocked-dependency",
          message: `Delete is blocked because this Service Subcategory is still a member of Service Group “${record.groupName}” under Service Category “${record.categoryName}”. No cascade or automatic removal is offered.`,
        });
        return;
      }

      try {
        await mutation.mutateAsync({ id: subcategory.id });
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
    <button type="button" className={className} aria-label={`Delete ${subcategory.name}`} onClick={begin}>{visibleLabel}</button>
    {feedback ? <GuardMessage feedback={feedback}
      onReload={feedback.state === "stale" ? () => { setFeedback(null); onReloadLatest(); } : undefined}
      onReconcile={feedback.state === "unknown-outcome" ? () => void reconcileDelete() : undefined} /> : null}
    {mutation.isError && kindOf(mutation.error) !== "unknown_outcome" ? <FailureMessage kind={kindOf(mutation.error)} action="delete" /> : null}
    {checking && !open ? <div className="state-indicator" data-state="pending" role="status">Checking latest Service Subcategory...</div> : null}
    {open ? <TypedSubcategoryDeleteDialog subcategoryId={subcategory.id} subcategoryName={subcategory.name}
      pending={mutation.isPending || checking} confirmation={confirmation} onConfirmationChange={setConfirmation}
      onCancel={() => { setOpen(false); reset(); }} onConfirm={() => void confirm()} /> : null}
  </>;
}
