import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import type { UpdateUserInput } from "../capability";
import {
  useAdminUserDetail,
  useAdminUserSafeguardEvidence,
  useUpdateAdminUser,
} from "../controller";
import { DeleteUserControl } from "../components/delete-user-control";
import { TypedConfirmationDialog } from "../components/dialogs";
import { FailureMessage, GuardMessage } from "../components/feedback";
import { UserForm } from "../components/user-form";
import { kindOf, listPath, withSearch } from "../route-utils";
import { formFromUser, toUpdateInput, type UserFormState } from "../user-form-model";
import {
  isSameIdentity,
  proveAnotherAdministrator,
  sameUserEvidence,
  userEvidence,
  userMatchesUpdate,
  type GuardFeedback,
} from "../user-safeguards";

export function AdminUserEditRoute({ userId: suppliedUserId }: { userId?: string } = {}) {
  const { userId: routeUserId } = useParams();
  const userId = suppliedUserId ?? routeUserId ?? "";
  const { session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  const detailQuery = useAdminUserDetail(userId, session?.token ?? "", Boolean(session && userId));
  const mutation = useUpdateAdminUser(session?.token ?? "");
  const evidence = useAdminUserSafeguardEvidence(session?.token ?? "");
  const [feedback, setFeedback] = useState<GuardFeedback | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [pendingInput, setPendingInput] = useState<UpdateUserInput | null>(null);
  const [reconcileInput, setReconcileInput] = useState<UpdateUserInput | null>(null);
  const [checking, setChecking] = useState(false);
  const back = listPath(location.search);

  useEffect(() => { document.title = "Edit User | Administrator"; heading.current?.focus(); }, []);

  const baseline = detailQuery.data;
  const formKey = useMemo(() => baseline ? userEvidence(baseline) : "loading", [baseline]);

  const reloadLatest = async () => {
    setFeedback(null);
    setPendingInput(null);
    setReconcileInput(null);
    setConfirmation("");
    await detailQuery.refetch();
  };

  const reconcileUpdate = async (input: UpdateUserInput) => {
    setChecking(true);
    try {
      const current = await evidence.refetchTarget(userId);
      if (userMatchesUpdate(current, input)) {
        setReconcileInput(null);
        navigate(withSearch(`/admin/users/${userId}`, location.search), {
          replace: true,
          state: { adminFeedback: `User ${current.name} updated successfully after reconciliation.` },
        });
      } else if (baseline && sameUserEvidence(current, baseline)) {
        setFeedback({ state: "unknown-outcome", message: "Update was not confirmed. Latest evidence is unchanged; you may retry the saved form after reconciliation." });
      } else {
        setReconcileInput(null);
        setFeedback({ state: "stale", message: "This User changed after you opened the form. Reload latest before updating." });
      }
    } catch {
      setFeedback({ state: "unknown-outcome", message: "Could not reconcile the update outcome. Check latest before retrying." });
    } finally {
      setChecking(false);
    }
  };

  const performUpdate = async (input: UpdateUserInput) => {
    if (!baseline) return;
    setChecking(true);
    setFeedback(null);
    setReconcileInput(input);
    try {
      const fresh = await evidence.refetchTarget(userId);
      if (!sameUserEvidence(fresh, baseline)) {
        setReconcileInput(null);
        setFeedback({ state: "stale", message: "This User changed after you opened the form. Reload latest before updating." });
        return;
      }
      if (isSameIdentity(session?.user, fresh)) {
        if (input.email !== undefined && input.email !== fresh.email) {
          setReconcileInput(null);
          setFeedback({ state: "validation-failure", message: "You cannot change the email of your own Administrator identity." });
          return;
        }
        if (input.role !== undefined && input.role !== "ADMIN") {
          setReconcileInput(null);
          setFeedback({ state: "validation-failure", message: "You cannot demote your own Administrator identity." });
          return;
        }
      }

      const roleChanges = input.role !== undefined && input.role !== fresh.role;
      if (roleChanges && fresh.role === "ADMIN") {
        let anotherAdmin = false;
        try {
          anotherAdmin = await proveAnotherAdministrator(fresh.id, evidence.listAllUsers);
        } catch {
          setReconcileInput(null);
          setFeedback({ state: "blocked-dependency", message: "Could not prove that another Administrator remains. Role change is blocked." });
          return;
        }
        if (!anotherAdmin) {
          setReconcileInput(null);
          setFeedback({ state: "blocked-dependency", message: "Role change is blocked because another Administrator cannot be proven to remain." });
          return;
        }
      }

      await mutation.mutateAsync({ id: userId, input });
      setReconcileInput(null);
      navigate(withSearch(`/admin/users/${userId}`, location.search), {
        replace: true,
        state: { adminFeedback: `User ${fresh.name} updated successfully.` },
      });
    } catch (error) {
      if (kindOf(error) === "unknown_outcome") {
        setFeedback({ state: "unknown-outcome", message: "Update outcome is unknown. Reconciling against the latest User evidence..." });
        await reconcileUpdate(input);
      }
    } finally {
      setChecking(false);
    }
  };

  const save = async (form: UserFormState) => {
    if (!baseline) return;
    const input = toUpdateInput(baseline, form);
    if (isSameIdentity(session?.user, baseline)) {
      if (input.email !== undefined && input.email !== baseline.email) {
        setFeedback({ state: "validation-failure", message: "You cannot change the email of your own Administrator identity." });
        return;
      }
      if (input.role !== undefined && input.role !== "ADMIN") {
        setFeedback({ state: "validation-failure", message: "You cannot demote your own Administrator identity." });
        return;
      }
    }
    const sensitive = input.email !== baseline.email || (input.role !== undefined && input.role !== baseline.role);
    if (sensitive) {
      if (!baseline.email.trim()) {
        setFeedback({ state: "blocked-dependency", message: "Sensitive changes are blocked because this User has no target email for typed confirmation." });
        return;
      }
      setFeedback(null);
      setPendingInput(input);
      setConfirmation("");
      return;
    }
    await performUpdate(input);
  };

  const pending = checking || mutation.isPending;
  return <main id="main-content" className="admin-user-edit">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to={back}>Users</Link><span aria-hidden="true">/</span><span aria-current="page">Edit</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">Account settings</span><h1 ref={heading} tabIndex={-1}>Edit User</h1><p>Update approved user information and role settings.</p></div></header>
    {detailQuery.isPending && <div className="state-indicator" data-state="loading" role="status">Loading user...</div>}
    {detailQuery.isError && <FailureMessage kind={kindOf(detailQuery.error)} action="load" onRetry={() => void detailQuery.refetch()} />}
    {pending && <div className="state-indicator" data-state="pending" role="status">Checking latest evidence and updating user...</div>}
    {feedback ? <GuardMessage feedback={feedback} onReload={() => void reloadLatest()}
      onReconcile={reconcileInput ? () => void reconcileUpdate(reconcileInput) : undefined} /> : null}
    {mutation.isError && kindOf(mutation.error) !== "unknown_outcome" ? <FailureMessage kind={kindOf(mutation.error)} action="update" /> : null}
    {baseline ? <>
      <UserForm key={formKey} initialValue={formFromUser(baseline)} originalUser={baseline} pending={pending}
        submitLabel="Save Changes" idPrefix="edit" cancelTo={back} onSubmit={save} />
      <div className="edit-destructive-actions" aria-label="Edit User destructive actions">
        <DeleteUserControl user={baseline} visibleLabel="Delete User" className="danger-button"
          onReloadLatest={() => void reloadLatest()} onDeleted={() => navigate(back, { replace: true, state: { adminFeedback: `User ${baseline.name} deleted successfully.` } })} />
      </div>
      {pendingInput ? <TypedConfirmationDialog user={baseline} title={`Confirm sensitive changes for ${baseline.name}`}
        description={`Email or role access is changing. Type the current target email before the latest evidence is checked.`}
        actionLabel="Confirm Changes" pendingLabel="Updating..." pending={pending}
        confirmation={confirmation} onConfirmationChange={setConfirmation}
        onCancel={() => { setPendingInput(null); setConfirmation(""); }}
        onConfirm={() => { const input = pendingInput; setPendingInput(null); void performUpdate(input); }} /> : null}
    </> : null}
  </main>;
}
