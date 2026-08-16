import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useSession } from "../authentication/public";
import {
  useAdminUserDetail,
  useAdminUserList,
  useCreateAdminUser,
  useDeleteAdminUser,
  useUpdateAdminUser,
} from "./controller";
import {
  AdminUserManagementFailure,
  type AdminUser,
  type CreateUserInput,
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
  role: "USER" | "ADMIN";
  skills: string;
  certifications: string;
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

function toInput(form: UserFormState): CreateUserInput {
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    birthday: form.birthday,
    gender: form.gender,
    role: form.role,
    skills: tags(form.skills),
    certifications: tags(form.certifications),
  };
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
    role: user.role,
    skills: user.skills.join(", "),
    certifications: user.certifications.join(", "),
  };
}

function kindOf(error: unknown): FailureKind {
  return error instanceof AdminUserManagementFailure ? error.kind : "unknown";
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
    unknown: "An unexpected error occurred. Please try again.",
  };
  const recoverable = ["malformed", "offline", "network", "server", "unknown"].includes(kind);
  return (
    <div className="state-indicator" data-state={kind} role="alert">
      <span>{messages[kind]}</span>
      {recoverable && onRetry ? (
        <button type="button" className="state-retry" onClick={onRetry}>Try again</button>
      ) : null}
    </div>
  );
}

function UserForm({
  initialValue,
  pending,
  submitLabel,
  idPrefix,
  onSubmit,
}: {
  initialValue: UserFormState;
  pending: boolean;
  submitLabel: string;
  idPrefix: string;
  onSubmit: (input: CreateUserInput) => Promise<void>;
}) {
  const [form, setForm] = useState(initialValue);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    setErrors(next);
    const firstInvalid = (["name", "email", "phone"] as const).find((field) => next[field]);
    if (firstInvalid) {
      queueMicrotask(() => document.getElementById(`${idPrefix}-${firstInvalid}`)?.focus());
    }
    return Object.keys(next).length === 0;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (validate()) await onSubmit(toInput(form));
  };

  return (
    <form className="admin-user-form" onSubmit={submit} noValidate aria-busy={pending}>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-name`}>Full Name *</label>
        <input id={`${idPrefix}-name`} value={form.name} required disabled={pending}
          onChange={(event) => { setForm({ ...form, name: event.target.value }); clear("name"); }}
          aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${idPrefix}-name-error` : undefined} />
        {errors.name && <div id={`${idPrefix}-name-error`} role="alert" className="error-message">{errors.name}</div>}
      </div>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-email`}>Email *</label>
        <input id={`${idPrefix}-email`} type="email" value={form.email} required disabled={pending}
          onChange={(event) => { setForm({ ...form, email: event.target.value }); clear("email"); }}
          aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${idPrefix}-email-error` : undefined} />
        {errors.email && <div id={`${idPrefix}-email-error`} role="alert" className="error-message">{errors.email}</div>}
      </div>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-phone`}>Phone</label>
        <input id={`${idPrefix}-phone`} type="tel" value={form.phone} disabled={pending}
          onChange={(event) => { setForm({ ...form, phone: event.target.value }); clear("phone"); }}
          aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? `${idPrefix}-phone-error` : undefined} />
        {errors.phone && <div id={`${idPrefix}-phone-error`} role="alert" className="error-message">{errors.phone}</div>}
      </div>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-birthday`}>Birthday</label>
        <input id={`${idPrefix}-birthday`} type="date" value={form.birthday} disabled={pending}
          onChange={(event) => setForm({ ...form, birthday: event.target.value })} />
      </div>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-gender`}>Gender</label>
        <select id={`${idPrefix}-gender`} value={String(form.gender)} disabled={pending}
          onChange={(event) => setForm({ ...form, gender: event.target.value === "true" })}>
          <option value="true">Male</option><option value="false">Female</option>
        </select>
      </div>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-role`}>Role *</label>
        <select id={`${idPrefix}-role`} value={form.role} disabled={pending}
          onChange={(event) => setForm({ ...form, role: event.target.value === "ADMIN" ? "ADMIN" : "USER" })}>
          <option value="USER">User</option><option value="ADMIN">Admin</option>
        </select>
        <small>Only USER and ADMIN roles are accepted.</small>
      </div>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-skills`}>Skills</label>
        <input id={`${idPrefix}-skills`} value={form.skills} disabled={pending} placeholder="React, TypeScript"
          onChange={(event) => setForm({ ...form, skills: event.target.value })} />
        <small>Separate multiple skills with commas.</small>
      </div>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-certifications`}>Certifications</label>
        <input id={`${idPrefix}-certifications`} value={form.certifications} disabled={pending} placeholder="WCAG, AWS"
          onChange={(event) => setForm({ ...form, certifications: event.target.value })} />
        <small>Separate multiple certifications with commas.</small>
      </div>
      <div className="form-actions">
        <button type="submit" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
        <Link to="/admin/users">Cancel</Link>
      </div>
    </form>
  );
}

function DeleteConfirmation({ user, pending, onCancel, onConfirm }: {
  user: AdminUser; pending: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div className="delete-confirmation" role="dialog" aria-modal="true"
      aria-labelledby="delete-user-title" aria-describedby="delete-user-description">
      <h2 id="delete-user-title">Delete user?</h2>
      <p id="delete-user-description">Delete {user.name} ({user.email})? This action cannot be undone.</p>
      <div className="form-actions">
        <button className="danger-button" type="button" onClick={onConfirm} disabled={pending}>
          {pending ? "Deleting..." : "Confirm Delete"}
        </button>
        <button className="secondary-button" type="button" onClick={onCancel} disabled={pending}>Cancel Delete</button>
      </div>
    </div>
  );
}

export function AdminUserListRoute() {
  const { session } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<AdminUser | null>(null);
  const deleteMutation = useDeleteAdminUser(session?.token ?? "");
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

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteCandidate.id });
      if (listQuery.data?.data.length === 1 && page > 1) setListState({ q, page: page - 1, pageSize }, true);
      setDeleteCandidate(null);
    } catch { /* mutation error is rendered */ }
  };

  return (
    <main id="main-content" className="admin-user-list">
      <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/admin">Overview</Link><span aria-hidden="true">/</span><span aria-current="page">Users</span>
      </nav>
      <header className="admin-page-heading admin-user-heading-row">
        <div>
          <span className="admin-eyebrow">People & access</span>
          <h1 ref={heading} tabIndex={-1}>User Management</h1>
          <p>Search, review, and manage marketplace user accounts.</p>
        </div>
        <Link to="/admin/users/new" className="button admin-primary-action"><span aria-hidden="true">+</span> Create User</Link>
      </header>
      {listQuery.isPending && <div className="state-indicator" data-state="loading" role="status">Loading users...</div>}
      {listQuery.isRefetching && !listQuery.isPending && <div className="state-indicator" data-state="refreshing" role="status">Refreshing users...</div>}
      {listQuery.isError && <FailureMessage kind={kindOf(listQuery.error)} action="load" onRetry={() => void listQuery.refetch()} />}
      {listState === "empty" && <div className="state-indicator" data-state="empty" role="status">No users found.</div>}
      {listState === "query-empty" && <div className="state-indicator" data-state="query-empty" role="status">No users match your search for “{q}”.</div>}
      {location.state?.adminFeedback ? (
        <div className="state-indicator" data-state="confirmed-success" role="status">
          {location.state.adminFeedback}
        </div>
      ) : null}
      {deleteMutation.isSuccess && !deleteCandidate && <div className="state-indicator" data-state="confirmed-success" role="status">User deleted successfully.</div>}

      <div className="user-list-controls">
        <div><label htmlFor="user-search">Search users</label><input id="user-search" type="search" value={q}
          placeholder="Search by name or email..." aria-label="Search users by name or email"
          onChange={(event) => setListState({ q: event.target.value, page: 1, pageSize }, true)} /></div>
        <div><label htmlFor="page-size-select">Page size</label><select id="page-size-select" value={pageSize}
          onChange={(event) => setListState({ q, page: 1, pageSize: Number(event.target.value) })}>
          {VALID_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} per page</option>)}
        </select></div>
        <div className="user-list-refresh">
          <span className="control-label" aria-hidden="true">Data</span>
          <button type="button" onClick={() => void listQuery.refetch()} disabled={listQuery.isPending || listQuery.isRefetching}>
            {listQuery.isRefetching ? "Refreshing..." : "Refresh users"}
          </button>
        </div>
      </div>

      {listState === "confirmed-success" && listQuery.data && <div className="user-list-table">
        <table role="grid" aria-label="User list">
          <thead><tr><th scope="col">User</th><th scope="col">Email</th><th scope="col">Phone</th><th scope="col">Role</th><th scope="col">Actions</th></tr></thead>
          <tbody>{listQuery.data.data.map((user) => <tr key={user.id}>
            <td data-label="User"><div className="admin-user-cell"><span className="admin-user-avatar" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span><span><strong>{user.name}</strong><small>ID {user.id}</small></span></div></td>
            <td data-label="Email">{user.email}</td>
            <td data-label="Phone">{user.phone || "—"}</td>
            <td data-label="Role"><span className={`role-badge role-${user.role.toLowerCase()}`}>{user.role}</span></td>
            <td data-label="Actions"><div className="row-actions">
              <Link to={`/admin/users/${user.id}`}>View</Link><Link to={`/admin/users/${user.id}/edit`}>Edit</Link>
              <button type="button" className="link-button danger-link" aria-label={`Delete ${user.name}`}
                onClick={() => { deleteMutation.reset(); setDeleteCandidate(user); }}>Delete</button>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>}

      {listState === "confirmed-success" && listQuery.data && totalPages > 1 && <nav className="pagination" aria-label="Pagination">
        <button type="button" onClick={() => setListState({ q, page: page - 1, pageSize })} disabled={page <= 1}>Previous</button>
        <span>Page {page} of {totalPages} (Total: {listQuery.data.totalRow} users)</span>
        <button type="button" onClick={() => setListState({ q, page: page + 1, pageSize })} disabled={page >= totalPages}>Next</button>
      </nav>}

      {deleteCandidate && <>{deleteMutation.isError && <FailureMessage kind={kindOf(deleteMutation.error)} action="delete" />}
        <DeleteConfirmation user={deleteCandidate} pending={deleteMutation.isPending}
          onCancel={() => { deleteMutation.reset(); setDeleteCandidate(null); }} onConfirm={() => void confirmDelete()} /></>}
    </main>
  );
}

export function AdminUserDetailRoute({ userId: suppliedUserId }: { userId?: string } = {}) {
  const { userId: routeUserId } = useParams();
  const userId = suppliedUserId ?? routeUserId ?? "";
  const { session } = useSession();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const [confirm, setConfirm] = useState(false);
  const detailQuery = useAdminUserDetail(userId, session?.token ?? "", Boolean(session && userId));
  const deleteMutation = useDeleteAdminUser(session?.token ?? "");
  useEffect(() => { document.title = "User Detail | Administrator"; heading.current?.focus(); }, []);
  const deleteUser = async () => { try { await deleteMutation.mutateAsync({ id: userId }); navigate("/admin/users", { replace: true }); } catch { /* rendered */ } };
  return <main id="main-content" className="admin-user-detail">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to="/admin/users">Users</Link><span aria-hidden="true">/</span><span aria-current="page">Detail</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">User record</span><h1 ref={heading} tabIndex={-1}>User Detail</h1><p>Review profile information and account access.</p></div></header>
    {detailQuery.isPending && <div className="state-indicator" data-state="loading" role="status">Loading user...</div>}
    {detailQuery.isError && <FailureMessage kind={kindOf(detailQuery.error)} action="load" onRetry={() => void detailQuery.refetch()} />}
    {detailQuery.data && <div className="user-detail"><dl>
      <dt>Name</dt><dd>{detailQuery.data.name}</dd><dt>Email</dt><dd>{detailQuery.data.email}</dd><dt>Phone</dt><dd>{detailQuery.data.phone || "Not provided"}</dd>
      <dt>Birthday</dt><dd>{detailQuery.data.birthday || "Not provided"}</dd><dt>Gender</dt><dd>{detailQuery.data.gender ? "Male" : "Female"}</dd>
      <dt>Role</dt><dd>{detailQuery.data.role}</dd><dt>Skills</dt><dd>{detailQuery.data.skills.length ? detailQuery.data.skills.join(", ") : "None"}</dd>
      <dt>Certifications</dt><dd>{detailQuery.data.certifications.length ? detailQuery.data.certifications.join(", ") : "None"}</dd></dl>
      <nav className="detail-actions" aria-label="User detail actions"><Link to="/admin/users">Back to list</Link><Link to={`/admin/users/${userId}/edit`}>Edit User</Link>
        <button type="button" className="danger-button" onClick={() => { deleteMutation.reset(); setConfirm(true); }}>Delete User</button></nav>
      {confirm && <>{deleteMutation.isError && <FailureMessage kind={kindOf(deleteMutation.error)} action="delete" />}
        <DeleteConfirmation user={detailQuery.data} pending={deleteMutation.isPending} onCancel={() => { deleteMutation.reset(); setConfirm(false); }} onConfirm={() => void deleteUser()} /></>}
    </div>}
  </main>;
}

export function AdminUserCreateRoute() {
  const { session } = useSession();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const mutation = useCreateAdminUser(session?.token ?? "");
  useEffect(() => { document.title = "Create User | Administrator"; heading.current?.focus(); }, []);
  const save = async (input: CreateUserInput) => {
    try {
      const created = await mutation.mutateAsync(input);
      navigate("/admin/users", {
        replace: true,
        state: { adminFeedback: `User ${created.name} created successfully.` },
      });
    } catch { /* rendered locally */ }
  };
  return <main id="main-content" className="admin-user-create">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to="/admin/users">Users</Link><span aria-hidden="true">/</span><span aria-current="page">Create</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">New account</span><h1 ref={heading} tabIndex={-1}>Create User</h1><p>Add a validated marketplace user without persisting temporary passwords.</p></div></header>
    {mutation.isPending && <div className="state-indicator" data-state="pending" role="status">Creating user...</div>}
    {mutation.isError && <FailureMessage kind={kindOf(mutation.error)} action="create" />}
    <UserForm initialValue={emptyForm()} pending={mutation.isPending} submitLabel="Create User" idPrefix="create" onSubmit={save} />
  </main>;
}

export function AdminUserEditRoute({ userId: suppliedUserId }: { userId?: string } = {}) {
  const { userId: routeUserId } = useParams();
  const userId = suppliedUserId ?? routeUserId ?? "";
  const { session } = useSession();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const detailQuery = useAdminUserDetail(userId, session?.token ?? "", Boolean(session && userId));
  const mutation = useUpdateAdminUser(session?.token ?? "");
  useEffect(() => { document.title = "Edit User | Administrator"; heading.current?.focus(); }, []);
  const save = async (input: CreateUserInput) => { try { await mutation.mutateAsync({ id: userId, input }); navigate(`/admin/users/${userId}`, { replace: true }); } catch { /* rendered */ } };
  return <main id="main-content" className="admin-user-edit">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to="/admin/users">Users</Link><span aria-hidden="true">/</span><span aria-current="page">Edit</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">Account settings</span><h1 ref={heading} tabIndex={-1}>Edit User</h1><p>Update approved user information and role settings.</p></div></header>
    {detailQuery.isPending && <div className="state-indicator" data-state="loading" role="status">Loading user...</div>}
    {detailQuery.isError && <FailureMessage kind={kindOf(detailQuery.error)} action="load" onRetry={() => void detailQuery.refetch()} />}
    {mutation.isPending && <div className="state-indicator" data-state="pending" role="status">Updating user...</div>}
    {mutation.isError && <FailureMessage kind={kindOf(mutation.error)} action="update" />}
    {detailQuery.data && <UserForm key={detailQuery.data.id} initialValue={formFromUser(detailQuery.data)} pending={mutation.isPending}
      submitLabel="Save Changes" idPrefix="edit" onSubmit={save} />}
  </main>;
}
