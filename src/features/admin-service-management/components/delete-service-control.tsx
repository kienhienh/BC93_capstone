import { useState } from "react";
import { useSession } from "../../authentication/public";
import type { AdminService } from "../capability";
import { useAdminServiceSafeguardEvidence, useDeleteAdminService } from "../controller";
import { kindOf } from "../route-utils";
import { sameServiceEvidence, type GuardFeedback } from "../service-safeguards";
import { FailureMessage, GuardMessage } from "./feedback";
import { TypedConfirmationDialog } from "./dialogs";

export function DeleteServiceControl({
  service,
  visibleLabel,
  className,
  onDeleted,
  onReloadLatest,
}: {
  service: AdminService;
  visibleLabel: string;
  className?: string;
  onDeleted: () => void;
  onReloadLatest: () => void;
}) {
  const { session } = useSession();
  const mutation = useDeleteAdminService(session?.token ?? "");
  const evidence = useAdminServiceSafeguardEvidence(session?.token ?? "");
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [feedback, setFeedback] = useState<GuardFeedback | null>(null);
  const [checking, setChecking] = useState(false);

  const reset = () => {
    mutation.reset();
    setConfirmation("");
    setFeedback(null);
    setChecking(false);
  };

  const begin = () => {
    reset();
    if (!service.title.trim()) {
      setFeedback({ state: "blocked-dependency", message: "Delete is blocked because this Service has no title for typed confirmation." });
      return;
    }
    setOpen(true);
  };

  const reconcileDelete = async () => {
    setChecking(true);
    try {
      const current = await evidence.refetchTarget(service.id);
      if (!sameServiceEvidence(current, service)) {
        setFeedback({ state: "stale", message: "This Service changed after you opened it. Reload latest before deleting." });
      } else {
        setFeedback({ state: "unknown-outcome", message: "Delete was not confirmed. The Service still exists; Retry is available after reconciliation." });
      }
    } catch (error) {
      if (kindOf(error) === "not_found") {
        setOpen(false);
        onDeleted();
      } else {
        setFeedback({ state: "unknown-outcome", message: "Could not reconcile the delete outcome. Check latest before retrying." });
      }
    } finally {
      setChecking(false);
    }
  };

  const confirm = async () => {
    setChecking(true);
    setFeedback(null);
    try {
      const fresh = await evidence.refetchTarget(service.id);
      if (!sameServiceEvidence(fresh, service)) {
        setFeedback({ state: "stale", message: "This Service changed after you opened it. Reload latest before deleting." });
        return;
      }
      let hasHires: boolean;
      try {
        hasHires = await evidence.hasHiresForService(fresh.id);
      } catch {
        setFeedback({ state: "blocked-dependency", message: "Could not prove this Service has no hires. Delete is blocked." });
        return;
      }
      if (hasHires) {
        setFeedback({ state: "blocked-dependency", message: "Delete is blocked because this Service has recorded hires." });
        return;
      }
      await mutation.mutateAsync({ id: fresh.id });
      setOpen(false);
      onDeleted();
    } catch (error) {
      if (kindOf(error) === "unknown_outcome") {
        setFeedback({ state: "unknown-outcome", message: "Delete outcome is unknown. Reconciling against the latest Service evidence..." });
        await reconcileDelete();
      }
    } finally {
      setChecking(false);
    }
  };

  const pending = checking || mutation.isPending;
  return (
    <>
      <button type="button" className={className} aria-label={`Delete ${service.title}`} onClick={begin}>{visibleLabel}</button>
      {feedback && !open ? <GuardMessage feedback={feedback} onReload={() => { setFeedback(null); onReloadLatest(); }} /> : null}
      {open ? (
        <>
          {feedback ? <GuardMessage feedback={feedback}
            onReload={() => { setOpen(false); setFeedback(null); onReloadLatest(); }}
            onReconcile={() => void reconcileDelete()} /> : null}
          {mutation.isError && kindOf(mutation.error) !== "unknown_outcome" ? (
            <FailureMessage kind={kindOf(mutation.error)} action="delete" />
          ) : null}
          <TypedConfirmationDialog subjectId={service.id} subjectLabel={service.title}
            confirmField={{ label: "Service title", value: service.title }}
            title={`Delete ${service.title}?`}
            description="This permanently deletes the Service. There is no cascade or force-delete path."
            actionLabel="Confirm Delete" pendingLabel="Deleting..." pending={pending}
            confirmation={confirmation} onConfirmationChange={setConfirmation}
            onCancel={() => { setOpen(false); reset(); }} onConfirm={() => void confirm()} />
        </>
      ) : null}
    </>
  );
}
