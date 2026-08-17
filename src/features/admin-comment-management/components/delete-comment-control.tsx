import { useState } from "react";
import { useSession } from "../../authentication/public";
import type { AdminComment } from "../capability";
import { useAdminCommentSafeguardEvidence, useDeleteAdminComment } from "../controller";
import { sameCommentEvidence, type GuardFeedback } from "../comment-safeguards";
import { kindOf } from "../route-utils";
import { DeleteCommentDialog } from "./dialogs";
import { FailureMessage, GuardMessage } from "./feedback";

export function DeleteCommentControl({ comment, visibleLabel, className, onDeleted, onReloadLatest }: {
  comment: AdminComment;
  visibleLabel: string;
  className?: string;
  onDeleted: () => void;
  onReloadLatest: () => void;
}) {
  const { session } = useSession();
  const mutation = useDeleteAdminComment(session?.token ?? "");
  const evidence = useAdminCommentSafeguardEvidence(session?.token ?? "");
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

  const reconcileDelete = async () => {
    setChecking(true);
    try {
      const current = await evidence.refetchEvidence(comment.serviceId, comment.id);
      if (!current) {
        onDeleted();
        return;
      }
      setFeedback({ state: "unknown-outcome", message: "Delete was not confirmed. The Comment still exists; no automatic retry was sent." });
    } catch {
      setFeedback({
        state: "unknown-outcome",
        message: "Delete outcome is still unknown because the latest Comment could not be checked. No destructive retry was sent.",
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
        current = await evidence.refetchEvidence(comment.serviceId, comment.id);
      } catch {
        setOpen(false);
        setFeedback({ state: "blocked-dependency", message: "Delete is blocked because the current Comment could not be verified." });
        return;
      }

      if (!current) {
        setOpen(false);
        setFeedback({ state: "stale", message: "This Comment no longer exists. Reload latest before taking another action." });
        return;
      }
      if (!sameCommentEvidence(current, comment)) {
        setOpen(false);
        setFeedback({ state: "stale", message: "This Comment changed after you opened it. Reload latest before deleting." });
        return;
      }

      try {
        await mutation.mutateAsync({ id: comment.id });
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
    <button type="button" className={className} aria-label={`Delete Comment ${comment.id}`} onClick={begin}>{visibleLabel}</button>
    {feedback ? <GuardMessage feedback={feedback}
      onReload={feedback.state === "stale" ? () => { setFeedback(null); onReloadLatest(); } : undefined}
      onReconcile={feedback.state === "unknown-outcome" ? () => void reconcileDelete() : undefined} /> : null}
    {mutation.isError && kindOf(mutation.error) !== "unknown_outcome" ? <FailureMessage kind={kindOf(mutation.error)} action="delete" /> : null}
    {checking && !open ? <div className="state-indicator" data-state="pending" role="status">Checking latest Comment...</div> : null}
    {open ? <DeleteCommentDialog commentId={comment.id} pending={mutation.isPending || checking}
      onCancel={() => { setOpen(false); reset(); }} onConfirm={() => void confirm()} /> : null}
  </>;
}
