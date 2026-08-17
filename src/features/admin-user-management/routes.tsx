import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useSession } from "../authentication/public";
import {
  useAdminUserDetail,
  useAdminUserList,
  useAdminUserSafeguardEvidence,
  useCreateAdminUser,
  useDeleteAdminUser,
  useUpdateAdminUser,
} from "./controller";
import {
  AdminUserManagementFailure,
  type AdminUser,
  type CanonicalAdminUserRole,
  type CreateUserInput,
  type UpdateUserInput,
} from "./capability";
import "./admin-user-management.css";

const VALID_PAGE_SIZES = [10, 25, 50] as const;
const DEFAULT_PAGE_SIZE = 10;

type FailureKind = AdminUserManagementFailure["kind"] | "unknown";
type UserFormState = {
  name: string;
  email: string;
  phone: string;
  birthday: string;
  gender: boolean;
  role: CanonicalAdminUserRole | "";
  skills: string;
  certifications: string;
};

type GuardFeedback = {
  state: "validation-failure" | "blocked-dependency" | "stale" | "unknown-outcome";
  message: string;
};

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return value && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function pageSizeFrom(value: string | null) {
  const parsed = Number(value);
  return VALID_PAGE_SIZES.some((size) => size === parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

function tags(value: string) {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function isCanonicalRole(role: string): role is CanonicalAdminUserRole {
  return role === "USER" || role === "ADMIN";
}

function toCreateInput(form: UserFormState): CreateUserInput {
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    birthday: form.birthday,
    gender: form.gender,
    role: form.role === "ADMIN" ? "ADMIN" : "USER",
    skills: tags(form.skills),
    certifications: tags(form.certifications),
  };
}

function toUpdateInput(original: AdminUser, form: UserFormState): UpdateUserInput {
  const input: UpdateUserInput = {
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    birthday: form.birthday,
    gender: form.gender,
    skills: tags(form.skills),
    certifications: tags(form.certifications),
  };
  if (form.role) input.role = form.role;
  else if (isCanonicalRole(original.role)) input.role = original.role;
  return input;
}

function emptyForm(): UserFormState {
  return {
    name: "",
    email: "",
    phone: "",
    birthday: "",
    gender: true,
    role: "USER",
    skills: "",
    certifications: "",
  };
}

function formFromUser(user: AdminUser): UserFormState {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone,
    birthday: user.birthday,
    gender: user.gender,
    role: isCanonicalRole(user.role) ? user.role : "",
    skills: user.skills.join(", "),
    certifications: user.certifications.join(", "),
  };
}

function kindOf(error: unknown): FailureKind {
  return error instanceof AdminUserManagementFailure ? error.kind : "unknown";
}

function userEvidence(user: AdminUser) {
  return JSON.stringify({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    birthday: user.birthday,
    avatar: user.avatar,
    gender: user.gender,
    role: user.role,
    skills: [...user.skills],
    certifications: [...user.certifications],
  });
}

function sameUserEvidence(left: AdminUser, right: AdminUser) {
  return userEvidence(left) === userEvidence(right);
}

function userMatchesUpdate(user: AdminUser, input: UpdateUserInput) {
  if (input.name !== undefined && user.name !== input.name) return false;
  if (input.email !== undefined && user.email !== input.email) return false;
  if (input.phone !== undefined && user.phone !== input.phone) return false;
  if (input.birthday !== undefined && user.birthday !== input.birthday) return false;
  if (input.gender !== undefined && user.gender !== input.gender) return false;
  if (input.role !== undefined && user.role !== input.role) return false;
  if (input.skills !== undefined && JSON.stringify(user.skills) !== JSON.stringify(input.skills)) return false;
  if (input.certifications !== undefined && JSON.stringify(user.certifications) !== JSON.stringify(input.certifications)) return false;
  return true;
}

function isSameIdentity(sessionUser: { id: string; email: string } | undefined, target: AdminUser) {
  return Boolean(sessionUser && (sessionUser.id === target.id || sessionUser.email === target.email));
}

function listPath(search: string) {
  return `/admin/users${search}`;
}

function withSearch(path: string, search: string) {
  return `${path}${search}`;
}

function FailureMessage({
  kind,
  action,
  onRetry,
}: {
  kind: FailureKind;
  action: string;
  onRetry?: () => void;
}) {
  const messages: Record<FailureKind, string> = {
    cancelled: "The request was cancelled.",
    malformed: "The server returned an invalid response.",
    offline: `You are offline. Cannot ${action} this user.`,
    network: "Network error. Please try again.",
    server: "Server error. Please try again later.",
    not_found: "User not found.",
    forbidden: "Access forbidden.",
    unauthorized: "Your session is not authorized for this action.",
    unknown_outcome: "The mutation outcome is unknown and must be reconciled before retrying.",
    unknown: "An unexpected error occurred. Please try again.",
  };
  const recoverable = ["malformed", "offline", "network", "server", "unknown"].includes(kind);
  return (
    <div className="state-indicator" data-state={kind.replaceAll("_", "-")} role="alert">
      <span>{messages[kind]}</span>
      {recoverable && onRetry ? (
        <button type="button" className="state-retry" onClick={onRetry}>Try again</button>
      ) : null}
    </div>
  );
}

function GuardMessage({ feedback, onReload, onReconcile }: {
  feedback: GuardFeedback;
  onReload?: () => void;
  onReconcile?: () => void;
}) {
  return (
    <div className="state-indicator" data-state={feedback.state} role="alert">
      <span>{feedback.message}</span>
      {feedback.state === "stale" && onReload ? (
        <button type="button" className="state-retry" onClick={onReload}>Reload latest</button>
      ) : null}
      {feedback.state === "unknown-outcome" && onReconcile ? (
        <button type="button" className="state-retry" onClick={onReconcile}>Check latest</button>
      ) : null}
    </div>
  );
}

function LegacyRoleWarning({ role }: { role: string }) {
  if (isCanonicalRole(role)) return null;
  return (
    <div className="legacy-role-warning" data-state="legacy-role" role="status">
      Legacy role “{role || "missing"}” is unsupported. It is displayed exactly as stored and will not be normalized automatically.
    </div>
  );
}

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
  ));
}

function AccessibleDialog({
  titleId,
  descriptionId,
  className = "admin-confirmation-dialog",
  initialFocusRef,
  onCancel,
  pending = false,
  children,
}: {
  titleId: string;
  descriptionId: string;
  className?: string;
  initialFocusRef: RefObject<HTMLElement | null>;
  onCancel: () => void;
  pending?: boolean;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    queueMicrotask(() => initialFocusRef.current?.focus());
    return () => restoreFocus.current?.focus();
  }, [initialFocusRef]);

  const keyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusables = focusableElements(dialogRef.current);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="admin-dialog-backdrop" role="presentation">
      <div ref={dialogRef} className={className} role="dialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={descriptionId} onKeyDown={keyDown}>
        {children}
      </div>
    </div>
  );
}

function TypedConfirmationDialog({
  user,
  title,
  description,
  actionLabel,
  pendingLabel,
  pending,
  confirmation,
  onConfirmationChange,
  onCancel,
  onConfirm,
}: {
  user: AdminUser;
  title: string;
  description: string;
  actionLabel: string;
  pendingLabel: string;
  pending: boolean;
  confirmation: string;
  onConfirmationChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const id = `confirm-${user.id}`;
  const matches = user.email.trim().length > 0 && confirmation === user.email;
  return (
    <AccessibleDialog titleId={`${id}-title`} descriptionId={`${id}-description`}
      initialFocusRef={cancelRef} onCancel={onCancel} pending={pending}>
      <h2 id={`${id}-title`}>{title}</h2>
      <p id={`${id}-description`}>{description}</p>
      <div className="confirmation-field">
        <label htmlFor={`${id}-email`}>Type {user.email} to confirm</label>
        <input id={`${id}-email`} value={confirmation} disabled={pending} autoComplete="off"
          onChange={(event) => onConfirmationChange(event.target.value)} />
      </div>
      <div className="dialog-actions">
        <button ref={cancelRef} className="secondary-button" type="button" onClick={onCancel} disabled={pending}
          aria-label={`Cancel ${actionLabel.toLowerCase()} for ${user.name}`}>Cancel</button>
        <button className="danger-button" type="button" onClick={onConfirm} disabled={pending || !matches}
          aria-label={`${actionLabel} for ${user.name}`}>
          {pending ? pendingLabel : actionLabel}
        </button>
      </div>
    </AccessibleDialog>
  );
}

function UnsavedChangesDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  const stayRef = useRef<HTMLButtonElement>(null);
  return (
    <AccessibleDialog titleId="unsaved-title" descriptionId="unsaved-description"
      initialFocusRef={stayRef} onCancel={onStay}>
      <h2 id="unsaved-title">Leave with unsaved changes?</h2>
      <p id="unsaved-description">Your non-secret form changes will be discarded. No password or temporary secret is stored.</p>
      <div className="dialog-actions">
        <button ref={stayRef} type="button" className="secondary-button" onClick={onStay}>Stay and keep editing</button>
        <button type="button" className="danger-button" onClick={onLeave}>Leave without saving</button>
      </div>
    </AccessibleDialog>
  );
}

function UserForm({
  initialValue,
  originalUser,
  pending,
  submitLabel,
  idPrefix,
  cancelTo,
  onSubmit,
}: {
  initialValue: UserFormState;
  originalUser?: AdminUser;
  pending: boolean;
  submitLabel: string;
  idPrefix: string;
  cancelTo: string;
  onSubmit: (form: UserFormState) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialValue);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const legacyRole = originalUser && !isCanonicalRole(originalUser.role) ? originalUser.role : null;

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      if (target.target === "_blank" || target.hasAttribute("download")) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#")) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation(href);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);

  const updateForm = (next: UserFormState) => {
    setForm(next);
    setDirty(true);
  };

  const clear = (field: string) => {
    if (errors[field]) setErrors((current) => ({ ...current, [field]: "" }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name) next.name = "Name is required.";
    else if (name.length < 2 || name.length > 50) next.name = "Name must contain 2–50 characters.";
    if (!email) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address.";
    if (form.phone && !/^[\d\s+()-]+$/.test(form.phone)) next.phone = "Enter a valid phone number.";
    if (!form.role && !legacyRole) next.role = "Choose USER or ADMIN.";
    setErrors(next);
    const firstInvalid = (["name", "email", "phone", "role"] as const).find((field) => next[field]);
    if (firstInvalid) queueMicrotask(() => document.getElementById(`${idPrefix}-${firstInvalid}`)?.focus());
    return Object.keys(next).length === 0;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (validate()) await onSubmit(form);
  };

  return (
    <>
      <form className="admin-user-form" onSubmit={submit} noValidate aria-busy={pending}>
        <div className="form-field">
          <label htmlFor={`${idPrefix}-name`}>Full Name *</label>
          <input id={`${idPrefix}-name`} value={form.name} required disabled={pending}
            onChange={(event) => { updateForm({ ...form, name: event.target.value }); clear("name"); }}
            aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${idPrefix}-name-error` : undefined} />
          {errors.name && <div id={`${idPrefix}-name-error`} role="alert" className="error-message">{errors.name}</div>}
        </div>
        <div className="form-field">
          <label htmlFor={`${idPrefix}-email`}>Email *</label>
          <input id={`${idPrefix}-email`} type="email" value={form.email} required disabled={pending}
            onChange={(event) => { updateForm({ ...form, email: event.target.value }); clear("email"); }}
            aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${idPrefix}-email-error` : undefined} />
          {errors.email && <div id={`${idPrefix}-email-error`} role="alert" className="error-message">{errors.email}</div>}
        </div>
        <div className="form-field">
          <label htmlFor={`${idPrefix}-phone`}>Phone</label>
          <input id={`${idPrefix}-phone`} type="tel" value={form.phone} disabled={pending}
            onChange={(event) => { updateForm({ ...form, phone: event.target.value }); clear("phone"); }}
            aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? `${idPrefix}-phone-error` : undefined} />
          {errors.phone && <div id={`${idPrefix}-phone-error`} role="alert" className="error-message">{errors.phone}</div>}
        </div>
        <div className="form-field">
          <label htmlFor={`${idPrefix}-birthday`}>Birthday</label>
          <input id={`${idPrefix}-birthday`} type="date" value={form.birthday} disabled={pending}
            onChange={(event) => updateForm({ ...form, birthday: event.target.value })} />
        </div>
        <div className="form-field">
          <label htmlFor={`${idPrefix}-gender`}>Gender</label>
          <select id={`${idPrefix}-gender`} value={String(form.gender)} disabled={pending}
            onChange={(event) => updateForm({ ...form, gender: event.target.value === "true" })}>
            <option value="true">Male</option><option value="false">Female</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor={`${idPrefix}-role`}>Role *</label>
          <select id={`${idPrefix}-role`} value={form.role} disabled={pending}
            onChange={(event) => {
              const role = event.target.value;
              updateForm({ ...form, role: role === "ADMIN" ? "ADMIN" : role === "USER" ? "USER" : "" });
              clear("role");
            }} aria-invalid={Boolean(errors.role)} aria-describedby={errors.role ? `${idPrefix}-role-error` : undefined}>
            {legacyRole ? <option value="">Legacy role: {legacyRole} (unchanged)</option> : null}
            <option value="USER">User</option><option value="ADMIN">Admin</option>
          </select>
          {errors.role && <div id={`${idPrefix}-role-error`} role="alert" className="error-message">{errors.role}</div>}
          {legacyRole ? <LegacyRoleWarning role={legacyRole} /> : <small>Only USER and ADMIN roles are accepted.</small>}
        </div>
        <div className="form-field">
          <label htmlFor={`${idPrefix}-skills`}>Skills</label>
          <input id={`${idPrefix}-skills`} value={form.skills} disabled={pending} placeholder="React, TypeScript"
            onChange={(event) => updateForm({ ...form, skills: event.target.value })} />
          <small>Separate multiple skills with commas.</small>
        </div>
        <div className="form-field">
          <label htmlFor={`${idPrefix}-certifications`}>Certifications</label>
          <input id={`${idPrefix}-certifications`} value={form.certifications} disabled={pending} placeholder="WCAG, AWS"
            onChange={(event) => updateForm({ ...form, certifications: event.target.value })} />
          <small>Separate multiple certifications with commas.</small>
        </div>
        <div className="form-actions">
          <button type="submit" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
          <Link to={cancelTo}>Cancel</Link>
        </div>
      </form>
      {pendingNavigation ? (
        <UnsavedChangesDialog onStay={() => setPendingNavigation(null)} onLeave={() => {
          const destination = pendingNavigation;
          setDirty(false);
          setPendingNavigation(null);
          queueMicrotask(() => navigate(destination));
        }} />
      ) : null}
    </>
  );
}

async function proveAnotherAdministrator(
  targetId: string,
  listAllUsers: () => Promise<readonly AdminUser[]>,
) {
  const users = await listAllUsers();
  return users.some((user) => user.id !== targetId && user.role === "ADMIN");
}

function DeleteUserControl({
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

export function AdminUserListRoute() {
  const { session } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const q = searchParams.get("q") ?? "";
  const page = positiveInteger(searchParams.get("page"), 1);
  const pageSize = pageSizeFrom(searchParams.get("pageSize"));
  const listQuery = useAdminUserList({ pageIndex: page, pageSize, keyword: q || undefined }, session?.token ?? "");
  const totalPages = listQuery.data ? Math.max(1, Math.ceil(listQuery.data.totalRow / pageSize)) : 1;

  useEffect(() => { document.title = "User Management | Administrator"; heading.current?.focus(); }, []);
  useEffect(() => {
    const canonical = new URLSearchParams();
    if (q) canonical.set("q", q);
    canonical.set("page", String(listQuery.data ? Math.min(page, totalPages) : page));
    canonical.set("pageSize", String(pageSize));
    if (canonical.toString() !== searchParams.toString()) setSearchParams(canonical, { replace: true });
  }, [listQuery.data, page, pageSize, q, searchParams, setSearchParams, totalPages]);

  const setListState = (next: { q: string; page: number; pageSize: number }, replace = false) => {
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    params.set("page", String(next.page));
    params.set("pageSize", String(next.pageSize));
    setSearchParams(params, { replace });
  };

  const listState = listQuery.isPending ? "loading" : listQuery.isError ? kindOf(listQuery.error)
    : listQuery.data?.data.length === 0 && q ? "query-empty"
      : listQuery.data?.data.length === 0 ? "empty" : "confirmed-success";

  return (
    <main id="main-content" className="admin-user-list">
      <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/admin">Overview</Link><span aria-hidden="true">/</span><span aria-current="page">Users</span>
      </nav>
      <header className="admin-page-heading admin-user-heading-row">
        <div><span className="admin-eyebrow">People & access</span><h1 ref={heading} tabIndex={-1}>User Management</h1>
          <p>Search, review, and manage marketplace user accounts.</p></div>
        <Link to="/admin/users/new" className="button admin-primary-action"><span aria-hidden="true">+</span> Create User</Link>
      </header>
      {listQuery.isPending && <div className="state-indicator" data-state="loading" role="status">Loading users...</div>}
      {listQuery.isRefetching && !listQuery.isPending && <div className="state-indicator" data-state="refreshing" role="status">Refreshing users...</div>}
      {listQuery.isError && <FailureMessage kind={kindOf(listQuery.error)} action="load" onRetry={() => void listQuery.refetch()} />}
      {listState === "empty" && <div className="state-indicator" data-state="empty" role="status">No users found.</div>}
      {listState === "query-empty" && <div className="state-indicator" data-state="query-empty" role="status">No users match your search for “{q}”.</div>}
      {location.state?.adminFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{location.state.adminFeedback}</div> : null}
      {deleteFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{deleteFeedback}</div> : null}
      {listState === "confirmed-success" && listQuery.data ? (
        <p className="user-list-scope" data-scope={listQuery.data.scope}>
          {listQuery.data.scope === "server"
            ? "User results are paginated and filtered by the User API."
            : "Pagination response was unusable, so this page is a client-filtered view of the complete User API snapshot."}
        </p>
      ) : null}

      <div className="user-list-controls">
        <div><label htmlFor="user-search">Search users</label><input id="user-search" type="search" value={q}
          placeholder="Search by name or email..." aria-label="Search users by name or email"
          onChange={(event) => setListState({ q: event.target.value, page: 1, pageSize }, true)} /></div>
        <div><label htmlFor="page-size-select">Page size</label><select id="page-size-select" value={pageSize}
          onChange={(event) => setListState({ q, page: 1, pageSize: Number(event.target.value) })}>
          {VALID_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} per page</option>)}
        </select></div>
        <div className="user-list-refresh"><span className="control-label" aria-hidden="true">Data</span>
          <button type="button" onClick={() => void listQuery.refetch()} disabled={listQuery.isPending || listQuery.isRefetching}>
            {listQuery.isRefetching ? "Refreshing..." : "Refresh users"}</button></div>
      </div>

      {listState === "confirmed-success" && listQuery.data ? <div className="user-list-table">
        <table role="grid" aria-label="User list">
          <thead><tr><th scope="col">User</th><th scope="col">Email</th><th scope="col">Phone</th><th scope="col">Role</th><th scope="col">Actions</th></tr></thead>
          <tbody>{listQuery.data.data.map((user) => <tr key={user.id}>
            <td data-label="User"><div className="admin-user-cell"><span className="admin-user-avatar" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span><span><strong>{user.name}</strong><small>ID {user.id}</small></span></div></td>
            <td data-label="Email">{user.email}</td><td data-label="Phone">{user.phone || "—"}</td>
            <td data-label="Role">{isCanonicalRole(user.role)
              ? <span className={`role-badge role-${user.role.toLowerCase()}`}>{user.role}</span>
              : <><span className="role-badge role-legacy">{user.role || "MISSING"}</span><span className="visually-hidden"> Unsupported legacy role</span></>}</td>
            <td data-label="Actions"><div className="row-actions">
              <Link aria-label={`View ${user.name}`} to={withSearch(`/admin/users/${user.id}`, location.search)}>View</Link>
              <Link aria-label={`Edit ${user.name}`} to={withSearch(`/admin/users/${user.id}/edit`, location.search)}>Edit</Link>
              <DeleteUserControl user={user} visibleLabel="Delete" className="link-button danger-link"
                onReloadLatest={() => void listQuery.refetch()} onDeleted={() => {
                  setDeleteFeedback(`User ${user.name} deleted successfully.`);
                  if (listQuery.data?.data.length === 1 && page > 1) setListState({ q, page: page - 1, pageSize }, true);
                  else void listQuery.refetch();
                }} />
            </div></td>
          </tr>)}</tbody>
        </table>
      </div> : null}

      {listState === "confirmed-success" && listQuery.data && totalPages > 1 ? <nav className="pagination" aria-label="Pagination">
        <button type="button" onClick={() => setListState({ q, page: page - 1, pageSize })} disabled={page <= 1}>Previous</button>
        <span>Page {page} of {totalPages} (Total: {listQuery.data.totalRow} users)</span>
        <button type="button" onClick={() => setListState({ q, page: page + 1, pageSize })} disabled={page >= totalPages}>Next</button>
      </nav> : null}
    </main>
  );
}

export function AdminUserDetailRoute({ userId: suppliedUserId }: { userId?: string } = {}) {
  const { userId: routeUserId } = useParams();
  const userId = suppliedUserId ?? routeUserId ?? "";
  const { session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  const detailQuery = useAdminUserDetail(userId, session?.token ?? "", Boolean(session && userId));
  useEffect(() => { document.title = "User Detail | Administrator"; heading.current?.focus(); }, []);
  const back = listPath(location.search);
  return <main id="main-content" className="admin-user-detail">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to={back}>Users</Link><span aria-hidden="true">/</span><span aria-current="page">Detail</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">User record</span><h1 ref={heading} tabIndex={-1}>User Detail</h1><p>Review profile information and account access.</p></div></header>
    {location.state?.adminFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{location.state.adminFeedback}</div> : null}
    {detailQuery.isPending && <div className="state-indicator" data-state="loading" role="status">Loading user...</div>}
    {detailQuery.isError && <FailureMessage kind={kindOf(detailQuery.error)} action="load" onRetry={() => void detailQuery.refetch()} />}
    {detailQuery.data ? <div className="user-detail"><LegacyRoleWarning role={detailQuery.data.role} /><dl>
      <dt>Name</dt><dd>{detailQuery.data.name}</dd><dt>Email</dt><dd>{detailQuery.data.email}</dd><dt>Phone</dt><dd>{detailQuery.data.phone || "Not provided"}</dd>
      <dt>Birthday</dt><dd>{detailQuery.data.birthday || "Not provided"}</dd><dt>Gender</dt><dd>{detailQuery.data.gender ? "Male" : "Female"}</dd>
      <dt>Role</dt><dd>{detailQuery.data.role || "Missing"}</dd><dt>Skills</dt><dd>{detailQuery.data.skills.length ? detailQuery.data.skills.join(", ") : "None"}</dd>
      <dt>Certifications</dt><dd>{detailQuery.data.certifications.length ? detailQuery.data.certifications.join(", ") : "None"}</dd></dl>
      <nav className="detail-actions" aria-label="User detail actions"><Link to={back}>Back to list</Link>
        <Link to={withSearch(`/admin/users/${userId}/edit`, location.search)}>Edit User</Link>
        <DeleteUserControl user={detailQuery.data} visibleLabel="Delete User" className="danger-button"
          onReloadLatest={() => void detailQuery.refetch()} onDeleted={() => navigate(back, { replace: true, state: { adminFeedback: `User ${detailQuery.data?.name ?? ""} deleted successfully.` } })} />
      </nav>
    </div> : null}
  </main>;
}

export function AdminUserCreateRoute() {
  const { session } = useSession();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const mutation = useCreateAdminUser(session?.token ?? "");
  useEffect(() => { document.title = "Create User | Administrator"; heading.current?.focus(); }, []);
  const save = async (form: UserFormState) => {
    try {
      const created = await mutation.mutateAsync(toCreateInput(form));
      navigate("/admin/users", { replace: true, state: { adminFeedback: `User ${created.name} created successfully.` } });
    } catch { /* rendered locally */ }
  };
  return <main id="main-content" className="admin-user-create">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to="/admin/users">Users</Link><span aria-hidden="true">/</span><span aria-current="page">Create</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">New account</span><h1 ref={heading} tabIndex={-1}>Create User</h1><p>Add a validated marketplace user without persisting temporary passwords.</p></div></header>
    {mutation.isPending && <div className="state-indicator" data-state="pending" role="status">Creating user...</div>}
    {mutation.isError && <FailureMessage kind={kindOf(mutation.error)} action="create" />}
    <UserForm initialValue={emptyForm()} pending={mutation.isPending} submitLabel="Create User" idPrefix="create" cancelTo="/admin/users" onSubmit={save} />
  </main>;
}

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
