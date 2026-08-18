import { useState } from "react";
import { useSession } from "../../authentication/public";
import type { AdminHiredService } from "../capability";
import { useAdminHiredServiceSafeguardEvidence, useCancelAdminHiredService } from "../controller";
import { sameHiredServiceEvidence, type GuardFeedback } from "../hired-service-safeguards";
import { kindOf } from "../route-utils";
import { CancelHiredServiceDialog } from "./dialogs";
import { FailureMessage, GuardMessage } from "./feedback";

export function CancelHiredServiceControl({ hiredService, visibleLabel, className, onCancelled, onReloadLatest }: {
  hiredService: AdminHiredService;
  visibleLabel: string;
  className?: string;
  onCancelled: () => void;
  onReloadLatest: () => void;
}) {
  const { session } = useSession();
  const mutation = useCancelAdminHiredService(session?.token ?? "");
  const evidence = useAdminHiredServiceSafeguardEvidence(session?.token ?? "");
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<GuardFeedback | null>(null);
  const [checking, setChecking] = useState(false);

  const reset = () => {
    mutation.reset();
    setFeedback(null);
    setChecking(false);
  };

  const begin = () => {
    reset();
    setOpen(true);
  };

  const reconcileCancel = async () => {
    setChecking(true);
    try {
      const current = await evidence.refetchEvidence(hiredService.id);
      if (!current) {
        onCancelled();
        return;
      }
      setFeedback({ state: "unknown-outcome", message: "Cancel was not confirmed. The Hired Service still exists; no automatic retry was sent." });
    } catch {
      setFeedback({
        state: "unknown-outcome",
        message: "Cancel outcome is still unknown because the latest status could not be checked. No destructive retry was sent.",
      });
    } finally {
      setChecking(false);
    }
  };

  const confirm = async () => {
    setChecking(true);
    setFeedback(null);
    try {
      let current;
      try {
        current = await evidence.refetchEvidence(hiredService.id);
      } catch {
        setOpen(false);
        setFeedback({ state: "blocked-dependency", message: "Cancel is blocked because the current status could not be verified." });
        return;
      }

      if (!current) {
        setOpen(false);
        setFeedback({ state: "stale", message: "This Hired Service no longer exists. Reload latest before taking another action." });
        return;
      }
      if (!sameHiredServiceEvidence(current, { id: hiredService.id, completed: hiredService.completed })) {
        setOpen(false);
        setFeedback({ state: "stale", message: "This Hired Service changed after you opened it. Reload latest before cancelling." });
        return;
      }

      try {
        await mutation.mutateAsync({ id: hiredService.id });
        setOpen(false);
        onCancelled();
      } catch (error) {
        setOpen(false);
        if (kindOf(error) === "unknown_outcome") await reconcileCancel();
      }
    } finally {
      setChecking(false);
    }
  };

  return <>
    <button type="button" className={className} aria-label={`Cancel Hired Service ${hiredService.id}`} onClick={begin}>{visibleLabel}</button>
    {feedback ? <GuardMessage feedback={feedback}
      onReload={feedback.state === "stale" ? () => { setFeedback(null); onReloadLatest(); } : undefined}
      onReconcile={feedback.state === "unknown-outcome" ? () => void reconcileCancel() : undefined} /> : null}
    {mutation.isError && kindOf(mutation.error) !== "unknown_outcome" ? <FailureMessage kind={kindOf(mutation.error)} action="cancel" /> : null}
    {checking && !open ? <div className="state-indicator" data-state="pending" role="status">Checking latest status...</div> : null}
    {open ? <CancelHiredServiceDialog hiredServiceId={hiredService.id} pending={mutation.isPending || checking}
      onCancel={() => { setOpen(false); reset(); }} onConfirm={() => void confirm()} /> : null}
  </>;
}
