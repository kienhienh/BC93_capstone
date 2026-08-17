import { useState } from "react";
import { useSession } from "../../authentication/public";
import type { AdminUser } from "../capability";
import { useAdminUserSafeguardEvidence, useDeleteAdminUser } from "../controller";
import { kindOf } from "../route-utils";
import {
  isSameIdentity,
  proveAnotherAdministrator,
  sameUserEvidence,
  type GuardFeedback,
} from "../user-safeguards";
import { FailureMessage, GuardMessage } from "./feedback";
import { TypedConfirmationDialog } from "./dialogs";

export function DeleteUserControl({
  user,
  visibleLabel,
  className,
  onDeleted,
  onReloadLatest,
}: {
  user: AdminUser;
  visibleLabel: string;
  className?: string;
  onDeleted: () => void;
  onReloadLatest: () => void;
}) {
  const { session } = useSession();
  const mutation = useDeleteAdminUser(session?.token ?? "");
  const evidence = useAdminUserSafeguardEvidence(session?.token ?? "");
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
    if (isSameIdentity(session?.user, user)) {
      setFeedback({ state: "validation-failure", message: "You cannot delete your own Administrator identity." });
      return;
    }
    if (!user.email.trim()) {
      setFeedback({ state: "blocked-dependency", message: "Delete is blocked because this User has no target email for typed confirmation." });
      return;
    }
    setOpen(true);
  };

  const reconcileDelete = async () => {
    setChecking(true);
    try {
      const current = await evidence.refetchTarget(user.id);
      if (!sameUserEvidence(current, user)) {
        setFeedback({ state: "stale", message: "This User changed after you opened it. Reload latest before deleting." });
      } else {
        setFeedback({ state: "unknown-outcome", message: "Delete was not confirmed. The User still exists; Retry is available after reconciliation." });
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
      const fresh = await evidence.refetchTarget(user.id);
      if (!sameUserEvidence(fresh, user)) {
        setFeedback({ state: "stale", message: "This User changed after you opened it. Reload latest before deleting." });
        return;
      }
      if (isSameIdentity(session?.user, fresh)) {
        setFeedback({ state: "validation-failure", message: "You cannot delete your own Administrator identity." });
        return;
      }
      if (fresh.role === "ADMIN") {
        let anotherAdmin = false;
        try {
          anotherAdmin = await proveAnotherAdministrator(fresh.id, evidence.listAllUsers);
        } catch {
          setFeedback({ state: "blocked-dependency", message: "Could not prove that another Administrator remains. Delete is blocked." });
          return;
        }
        if (!anotherAdmin) {
          setFeedback({ state: "blocked-dependency", message: "Delete is blocked because another Administrator cannot be proven to remain." });
          return;
        }
      }
      await mutation.mutateAsync({ id: fresh.id });
      setOpen(false);
      onDeleted();
    } catch (error) {
      if (kindOf(error) === "unknown_outcome") {
        setFeedback({ state: "unknown-outcome", message: "Delete outcome is unknown. Reconciling against the latest User evidence..." });
        await reconcileDelete();
      }
    } finally {
      setChecking(false);
    }
  };

  const pending = checking || mutation.isPending;
  return (
    <>
      <button type="button" className={className} aria-label={`Delete ${user.name}`} onClick={begin}>{visibleLabel}</button>
      {feedback && !open ? <GuardMessage feedback={feedback} onReload={() => { setFeedback(null); onReloadLatest(); }} /> : null}
      {open ? (
        <>
          {feedback ? <GuardMessage feedback={feedback}
            onReload={() => { setOpen(false); setFeedback(null); onReloadLatest(); }}
            onReconcile={() => void reconcileDelete()} /> : null}
          {mutation.isError && kindOf(mutation.error) !== "unknown_outcome" ? (
            <FailureMessage kind={kindOf(mutation.error)} action="delete" />
          ) : null}
          <TypedConfirmationDialog user={user} title={`Delete ${user.name}?`}
            description={`This permanently deletes ${user.email}. There is no cascade or force-delete path.`}
            actionLabel="Confirm Delete" pendingLabel="Deleting..." pending={pending}
            confirmation={confirmation} onConfirmationChange={setConfirmation}
            onCancel={() => { setOpen(false); reset(); }} onConfirm={() => void confirm()} />
        </>
      ) : null}
    </>
  );
}
