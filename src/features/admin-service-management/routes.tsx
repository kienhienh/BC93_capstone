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
import { useAdminUserManagementCapability, type AdminUser } from "../admin-user-management/wiring";
import { useTaxonomy } from "../taxonomy/public";
import type { ServiceCategory } from "../taxonomy/wiring";
import {
  useAdminServiceDetail,
  useAdminServiceList,
  useAdminServiceSafeguardEvidence,
  useCreateAdminService,
  useDeleteAdminService,
  useUpdateAdminService,
  useUploadServiceImage,
} from "./controller";
import {
  AdminServiceManagementFailure,
  type AdminService,
  type CreateServiceInput,
  type UpdateServiceInput,
} from "./capability";
import { validateServiceForm, validateServiceImage } from "./validation";
import "./admin-service-management.css";

const VALID_PAGE_SIZES = [10, 25, 50] as const;
const DEFAULT_PAGE_SIZE = 10;

type FailureKind = AdminServiceManagementFailure["kind"] | "unknown";

type SellerRef = { id: string; name: string; email: string };

type TaxonomySelection = { categoryId: string; groupId: string; subcategoryId: string };

type ServiceFormState = {
  title: string;
  shortDescription: string;
  description: string;
  price: string;
  rating: string;
  seller: SellerRef | null;
} & TaxonomySelection;

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

function kindOf(error: unknown): FailureKind {
  return error instanceof AdminServiceManagementFailure ? error.kind : "unknown";
}

function listPath(search: string) {
  return `/admin/services${search}`;
}

function withSearch(path: string, search: string) {
  return `${path}${search}`;
}

function serviceEvidence(service: AdminService) {
  return JSON.stringify({
    id: service.id,
    title: service.title,
    description: service.description,
    shortDescription: service.shortDescription,
    price: service.price,
    imageUrl: service.imageUrl,
    rating: service.rating,
    reviewCount: service.reviewCount,
    sellerId: service.sellerId,
    subcategoryId: service.subcategoryId,
  });
}

function sameServiceEvidence(left: AdminService, right: AdminService) {
  return serviceEvidence(left) === serviceEvidence(right);
}

function serviceMatchesUpdate(service: AdminService, input: UpdateServiceInput) {
  return (
    service.title === input.title
    && service.description === input.description
    && service.shortDescription === input.shortDescription
    && service.price === input.price
    && service.sellerId === input.sellerId
    && service.subcategoryId === input.subcategoryId
    && service.rating === input.rating
  );
}

function findTaxonomyPath(categories: readonly ServiceCategory[], subcategoryId: string): TaxonomySelection {
  for (const category of categories) {
    for (const group of category.groups) {
      const subcategory = group.subcategories.find((item) => item.id === subcategoryId);
      if (subcategory) return { categoryId: category.id, groupId: group.id, subcategoryId: subcategory.id };
    }
  }
  return { categoryId: "", groupId: "", subcategoryId };
}

function toCreateInput(form: ServiceFormState): CreateServiceInput {
  return {
    title: form.title.trim(),
    shortDescription: form.shortDescription.trim(),
    description: form.description.trim(),
    price: Number(form.price),
    sellerId: form.seller?.id ?? "",
    subcategoryId: form.subcategoryId,
    rating: Number(form.rating),
  };
}

function toUpdateInput(baseline: AdminService, form: ServiceFormState): UpdateServiceInput {
  return { ...toCreateInput(form), reviewCount: baseline.reviewCount };
}

function emptyForm(): ServiceFormState {
  return {
    title: "",
    shortDescription: "",
    description: "",
    price: "",
    rating: "0",
    seller: null,
    categoryId: "",
    groupId: "",
    subcategoryId: "",
  };
}

function formFromService(service: AdminService, categories: readonly ServiceCategory[]): ServiceFormState {
  const path = findTaxonomyPath(categories, service.subcategoryId);
  return {
    title: service.title,
    shortDescription: service.shortDescription,
    description: service.description,
    price: String(service.price),
    rating: String(service.rating),
    seller: { id: service.sellerId, name: service.sellerName ?? `User ${service.sellerId}`, email: "" },
    ...path,
  };
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
    offline: `You are offline. Cannot ${action} this Service.`,
    network: "Network error. Please try again.",
    server: "Server error. Please try again later.",
    not_found: "Service not found.",
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
  subjectId,
  subjectLabel,
  confirmField,
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
  subjectId: string;
  subjectLabel: string;
  confirmField: { label: string; value: string };
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
  const id = `confirm-${subjectId}`;
  const matches = confirmField.value.trim().length > 0 && confirmation === confirmField.value;
  return (
    <AccessibleDialog titleId={`${id}-title`} descriptionId={`${id}-description`}
      initialFocusRef={cancelRef} onCancel={onCancel} pending={pending}>
      <h2 id={`${id}-title`}>{title}</h2>
      <p id={`${id}-description`}>{description}</p>
      <div className="confirmation-field">
        <label htmlFor={`${id}-value`}>Type {confirmField.value} to confirm</label>
        <input id={`${id}-value`} value={confirmation} disabled={pending} autoComplete="off"
          onChange={(event) => onConfirmationChange(event.target.value)} />
        <small>{confirmField.label}</small>
      </div>
      <div className="dialog-actions">
        <button ref={cancelRef} className="secondary-button" type="button" onClick={onCancel} disabled={pending}
          aria-label={`Cancel ${actionLabel.toLowerCase()} for ${subjectLabel}`}>Cancel</button>
        <button className="danger-button" type="button" onClick={onConfirm} disabled={pending || !matches}
          aria-label={`${actionLabel} for ${subjectLabel}`}>
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
      <p id="unsaved-description">Your non-secret form changes will be discarded. No upload file or temporary secret is stored.</p>
      <div className="dialog-actions">
        <button ref={stayRef} type="button" className="secondary-button" onClick={onStay}>Stay and keep editing</button>
        <button type="button" className="danger-button" onClick={onLeave}>Leave without saving</button>
      </div>
    </AccessibleDialog>
  );
}

function SellerPicker({
  idPrefix,
  value,
  onChange,
  pending,
  error,
}: {
  idPrefix: string;
  value: SellerRef | null;
  onChange: (seller: SellerRef | null) => void;
  pending: boolean;
  error?: string;
}) {
  const { session } = useSession();
  const userCapability = useAdminUserManagementCapability();
  const [query, setQuery] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<readonly AdminUser[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const controller = new AbortController();
    const trimmed = query.trim();
    (async () => {
      setSearching(true);
      try {
        const token = session?.token ?? "";
        const found = trimmed.length >= 2
          ? await userCapability.searchUsersByName(trimmed, token, controller.signal)
          : await userCapability.listAllUsers(token, controller.signal);
        if (!active) return;
        const needle = trimmed.toLowerCase();
        const filtered = trimmed && trimmed.length < 2
          ? found.filter((user) => user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle))
          : found;
        setResults(filtered.slice(0, 20));
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [query, open, session?.token, userCapability]);

  const select = (user: AdminUser) => {
    onChange({ id: user.id, name: user.name, email: user.email });
    setQuery(user.name);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery("");
  };

  return (
    <div className="form-field seller-picker">
      <label htmlFor={`${idPrefix}-sellerId`}>Seller *</label>
      <input
        id={`${idPrefix}-sellerId`}
        value={query}
        disabled={pending}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${idPrefix}-seller-listbox`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${idPrefix}-sellerId-error` : undefined}
        placeholder="Search Users by name or email..."
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (value) onChange(null);
        }}
      />
      {value ? <p className="seller-picker-selected">Selected: {value.name} ({value.email || `User ${value.id}`})</p> : null}
      {open ? (
        <ul id={`${idPrefix}-seller-listbox`} role="listbox" aria-label="Matching Users" className="seller-picker-results">
          {searching ? <li className="seller-picker-status">Searching...</li> : null}
          {!searching && results.length === 0 ? <li className="seller-picker-status">No matching Users.</li> : null}
          {results.map((user) => (
            <li key={user.id}>
              <button type="button" role="option" aria-selected={value?.id === user.id} onClick={() => select(user)}>
                {user.name} <small>{user.email}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {value ? (
        <button type="button" className="link-button" onClick={clear} disabled={pending}>Clear Seller</button>
      ) : null}
      {error && <div id={`${idPrefix}-sellerId-error`} role="alert" className="error-message">{error}</div>}
      <small>Sellers are always selected from existing Users, never typed freely.</small>
    </div>
  );
}

function TaxonomyPicker({
  idPrefix,
  categories,
  value,
  onChange,
  pending,
  error,
}: {
  idPrefix: string;
  categories: readonly ServiceCategory[];
  value: TaxonomySelection;
  onChange: (next: TaxonomySelection) => void;
  pending: boolean;
  error?: string;
}) {
  const category = categories.find((item) => item.id === value.categoryId);
  const groups = category?.groups ?? [];
  const group = groups.find((item) => item.id === value.groupId);
  const subcategories = group?.subcategories ?? [];

  return (
    <>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-categoryId`}>Category *</label>
        <select id={`${idPrefix}-categoryId`} value={value.categoryId} disabled={pending}
          onChange={(event) => {
            const nextCategory = categories.find((item) => item.id === event.target.value);
            const firstGroup = nextCategory?.groups[0];
            const firstSubcategory = firstGroup?.subcategories[0];
            onChange({ categoryId: event.target.value, groupId: firstGroup?.id ?? "", subcategoryId: firstSubcategory?.id ?? "" });
          }}>
          <option value="">Select a category</option>
          {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-groupId`}>Group *</label>
        <select id={`${idPrefix}-groupId`} value={value.groupId} disabled={pending || !category}
          onChange={(event) => {
            const nextGroup = groups.find((item) => item.id === event.target.value);
            const firstSubcategory = nextGroup?.subcategories[0];
            onChange({ ...value, groupId: event.target.value, subcategoryId: firstSubcategory?.id ?? "" });
          }}>
          <option value="">Select a group</option>
          {groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-subcategoryId`}>Subcategory *</label>
        <select id={`${idPrefix}-subcategoryId`} value={value.subcategoryId} disabled={pending || !group}
          aria-invalid={Boolean(error)} aria-describedby={error ? `${idPrefix}-subcategoryId-error` : undefined}
          onChange={(event) => onChange({ ...value, subcategoryId: event.target.value })}>
          <option value="">Select a subcategory</option>
          {subcategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        {error && <div id={`${idPrefix}-subcategoryId-error`} role="alert" className="error-message">{error}</div>}
      </div>
    </>
  );
}

function ServiceForm({
  initialValue,
  categories,
  categoriesPending,
  pending,
  submitLabel,
  idPrefix,
  cancelTo,
  onSubmit,
}: {
  initialValue: ServiceFormState;
  categories: readonly ServiceCategory[];
  categoriesPending: boolean;
  pending: boolean;
  submitLabel: string;
  idPrefix: string;
  cancelTo: string;
  onSubmit: (form: ServiceFormState) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialValue);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

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

  const updateForm = (next: ServiceFormState) => {
    setForm(next);
    setDirty(true);
  };

  const clear = (field: string) => {
    if (errors[field]) setErrors((current) => ({ ...current, [field]: "" }));
  };

  const validate = () => {
    const result = validateServiceForm({
      title: form.title,
      shortDescription: form.shortDescription,
      description: form.description,
      price: form.price,
      rating: form.rating,
      sellerId: form.seller?.id ?? "",
      subcategoryId: form.subcategoryId,
    });
    if (result.ok) {
      setErrors({});
      return true;
    }
    setErrors(result.errors);
    const order = ["title", "shortDescription", "description", "price", "rating", "sellerId", "subcategoryId"] as const;
    const firstInvalid = order.find((field) => result.errors[field]);
    if (firstInvalid) queueMicrotask(() => document.getElementById(`${idPrefix}-${firstInvalid}`)?.focus());
    return false;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (validate()) await onSubmit(form);
  };

  return (
    <>
      <form className="admin-service-form" onSubmit={submit} noValidate aria-busy={pending}>
        <div className="form-field">
          <label htmlFor={`${idPrefix}-title`}>Title *</label>
          <input id={`${idPrefix}-title`} value={form.title} required disabled={pending}
            onChange={(event) => { updateForm({ ...form, title: event.target.value }); clear("title"); }}
            aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? `${idPrefix}-title-error` : undefined} />
          {errors.title && <div id={`${idPrefix}-title-error`} role="alert" className="error-message">{errors.title}</div>}
        </div>
        <div className="form-field">
          <label htmlFor={`${idPrefix}-shortDescription`}>Short Description *</label>
          <input id={`${idPrefix}-shortDescription`} value={form.shortDescription} required disabled={pending}
            onChange={(event) => { updateForm({ ...form, shortDescription: event.target.value }); clear("shortDescription"); }}
            aria-invalid={Boolean(errors.shortDescription)} aria-describedby={errors.shortDescription ? `${idPrefix}-shortDescription-error` : undefined} />
          {errors.shortDescription && <div id={`${idPrefix}-shortDescription-error`} role="alert" className="error-message">{errors.shortDescription}</div>}
        </div>
        <div className="form-field admin-service-form-wide">
          <label htmlFor={`${idPrefix}-description`}>Description *</label>
          <textarea id={`${idPrefix}-description`} value={form.description} required disabled={pending} rows={5}
            onChange={(event) => { updateForm({ ...form, description: event.target.value }); clear("description"); }}
            aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? `${idPrefix}-description-error` : undefined} />
          {errors.description && <div id={`${idPrefix}-description-error`} role="alert" className="error-message">{errors.description}</div>}
        </div>
        <div className="form-field">
          <label htmlFor={`${idPrefix}-price`}>Price (USD) *</label>
          <input id={`${idPrefix}-price`} type="number" min="0" step="1" value={form.price} required disabled={pending}
            onChange={(event) => { updateForm({ ...form, price: event.target.value }); clear("price"); }}
            aria-invalid={Boolean(errors.price)} aria-describedby={errors.price ? `${idPrefix}-price-error` : undefined} />
          {errors.price && <div id={`${idPrefix}-price-error`} role="alert" className="error-message">{errors.price}</div>}
        </div>
        <div className="form-field">
          <label htmlFor={`${idPrefix}-rating`}>Rating (0-5) *</label>
          <input id={`${idPrefix}-rating`} type="number" min="0" max="5" step="1" value={form.rating} required disabled={pending}
            onChange={(event) => { updateForm({ ...form, rating: event.target.value }); clear("rating"); }}
            aria-invalid={Boolean(errors.rating)} aria-describedby={errors.rating ? `${idPrefix}-rating-error` : undefined} />
          {errors.rating && <div id={`${idPrefix}-rating-error`} role="alert" className="error-message">{errors.rating}</div>}
        </div>
        <SellerPicker idPrefix={idPrefix} value={form.seller} pending={pending} error={errors.sellerId}
          onChange={(seller) => { updateForm({ ...form, seller }); clear("sellerId"); }} />
        {categoriesPending ? (
          <div className="form-field"><small>Loading categories...</small></div>
        ) : (
          <TaxonomyPicker idPrefix={idPrefix} categories={categories} pending={pending} error={errors.subcategoryId}
            value={{ categoryId: form.categoryId, groupId: form.groupId, subcategoryId: form.subcategoryId }}
            onChange={(next) => { updateForm({ ...form, ...next }); clear("subcategoryId"); }} />
        )}
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

function DeleteServiceControl({
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

function ServiceImageUpload({ serviceId, currentImageUrl }: { serviceId: string; currentImageUrl: string | null }) {
  const { session } = useSession();
  const mutation = useUploadServiceImage(session?.token ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const choose = (file: File | null) => {
    setLocalError(null);
    mutation.reset();
    if (!file) return;
    const result = validateServiceImage(file);
    if (!result.ok) {
      setLocalError(result.message);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    mutation.mutate({ id: serviceId, file });
  };

  return (
    <section className="admin-service-image-upload" aria-labelledby="service-image-heading">
      <h2 id="service-image-heading">Service Image</h2>
      <p>Saving metadata and uploading an image are separate, independently confirmed actions.</p>
      {currentImageUrl ? (
        <img src={currentImageUrl} alt="" className="admin-service-image-preview" />
      ) : (
        <div className="state-indicator" data-state="empty" role="status">No image uploaded.</div>
      )}
      <div className="form-field">
        <label htmlFor="service-image-input">Upload a new image (JPEG, PNG, or WebP, up to 5 MB)</label>
        <input ref={inputRef} id="service-image-input" type="file" accept="image/jpeg,image/png,image/webp"
          disabled={mutation.isPending}
          onChange={(event) => choose(event.target.files?.[0] ?? null)} />
      </div>
      {mutation.isPending && <div className="state-indicator" data-state="pending" role="status">Uploading image...</div>}
      {mutation.isSuccess && !localError ? (
        <div className="state-indicator" data-state="confirmed-success" role="status">Image uploaded successfully.</div>
      ) : null}
      {localError ? <div role="alert" className="error-message">{localError}</div> : null}
      {mutation.isError && !localError ? <FailureMessage kind={kindOf(mutation.error)} action="upload the image for" /> : null}
    </section>
  );
}

export function AdminServiceListRoute() {
  const { session } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation() as ReturnType<typeof useLocation> & {
    state?: { adminFeedback?: string; createdServiceId?: string } | null;
  };
  const heading = useRef<HTMLHeadingElement>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const q = searchParams.get("q") ?? "";
  const page = positiveInteger(searchParams.get("page"), 1);
  const pageSize = pageSizeFrom(searchParams.get("pageSize"));
  const listQuery = useAdminServiceList({ pageIndex: page, pageSize, keyword: q || undefined }, session?.token ?? "");
  const totalPages = listQuery.data ? Math.max(1, Math.ceil(listQuery.data.totalRow / pageSize)) : 1;

  useEffect(() => { document.title = "Service Management | Administrator"; heading.current?.focus(); }, []);
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
    <main id="main-content" className="admin-service-list">
      <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/admin">Overview</Link><span aria-hidden="true">/</span><span aria-current="page">Services</span>
      </nav>
      <header className="admin-page-heading admin-service-heading-row">
        <div><span className="admin-eyebrow">Marketplace catalog</span><h1 ref={heading} tabIndex={-1}>Service Management</h1>
          <p>Search, review, and manage marketplace Services.</p></div>
        <Link to="/admin/services/new" className="button admin-primary-action"><span aria-hidden="true">+</span> Create Service</Link>
      </header>
      {listQuery.isPending && <div className="state-indicator" data-state="loading" role="status">Loading Services...</div>}
      {listQuery.isRefetching && !listQuery.isPending && <div className="state-indicator" data-state="refreshing" role="status">Refreshing Services...</div>}
      {listQuery.isError && <FailureMessage kind={kindOf(listQuery.error)} action="load" onRetry={() => void listQuery.refetch()} />}
      {listState === "empty" && <div className="state-indicator" data-state="empty" role="status">No Services found.</div>}
      {listState === "query-empty" && <div className="state-indicator" data-state="query-empty" role="status">No Services match your search for “{q}”.</div>}
      {location.state?.adminFeedback ? (
        <div className="state-indicator" data-state="confirmed-success" role="status">
          {location.state.adminFeedback}
          {location.state.createdServiceId ? (
            <Link to={`/admin/services/${location.state.createdServiceId}/edit`}> Add an image now</Link>
          ) : null}
        </div>
      ) : null}
      {deleteFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{deleteFeedback}</div> : null}
      {listState === "confirmed-success" && listQuery.data ? (
        <p className="admin-list-scope" data-scope={listQuery.data.scope}>
          {listQuery.data.scope === "server"
            ? "Service results are paginated and filtered by the Service API."
            : "Pagination response was unusable, so this page is a client-filtered view of the complete Service API snapshot."}
        </p>
      ) : null}

      <div className="admin-list-controls">
        <div><label htmlFor="service-search">Search Services</label><input id="service-search" type="search" value={q}
          placeholder="Search by title..." aria-label="Search Services by title"
          onChange={(event) => setListState({ q: event.target.value, page: 1, pageSize }, true)} /></div>
        <div><label htmlFor="page-size-select">Page size</label><select id="page-size-select" value={pageSize}
          onChange={(event) => setListState({ q, page: 1, pageSize: Number(event.target.value) })}>
          {VALID_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} per page</option>)}
        </select></div>
        <div className="admin-list-refresh"><span className="control-label" aria-hidden="true">Data</span>
          <button type="button" onClick={() => void listQuery.refetch()} disabled={listQuery.isPending || listQuery.isRefetching}>
            {listQuery.isRefetching ? "Refreshing..." : "Refresh Services"}</button></div>
      </div>

      {listState === "confirmed-success" && listQuery.data ? <div className="admin-data-table">
        <table role="grid" aria-label="Service list">
          <thead><tr><th scope="col">Service</th><th scope="col">Seller</th><th scope="col">Price</th><th scope="col">Rating</th><th scope="col">Actions</th></tr></thead>
          <tbody>{listQuery.data.data.map((service) => <tr key={service.id}>
            <td data-label="Service"><div className="admin-service-cell"><span className="admin-service-avatar" aria-hidden="true">{service.title.charAt(0).toUpperCase()}</span><span><strong>{service.title}</strong><small>ID {service.id}</small></span></div></td>
            <td data-label="Seller">{service.sellerName ?? `User ${service.sellerId}`}</td>
            <td data-label="Price">${service.price}</td>
            <td data-label="Rating">{service.rating.toFixed(1)} <small>({service.reviewCount})</small></td>
            <td data-label="Actions"><div className="row-actions">
              <Link aria-label={`View ${service.title}`} to={withSearch(`/admin/services/${service.id}`, location.search)}>View</Link>
              <Link aria-label={`Edit ${service.title}`} to={withSearch(`/admin/services/${service.id}/edit`, location.search)}>Edit</Link>
              <DeleteServiceControl service={service} visibleLabel="Delete" className="link-button danger-link"
                onReloadLatest={() => void listQuery.refetch()} onDeleted={() => {
                  setDeleteFeedback(`Service ${service.title} deleted successfully.`);
                  if (listQuery.data?.data.length === 1 && page > 1) setListState({ q, page: page - 1, pageSize }, true);
                  else void listQuery.refetch();
                }} />
            </div></td>
          </tr>)}</tbody>
        </table>
      </div> : null}

      {listState === "confirmed-success" && listQuery.data && totalPages > 1 ? <nav className="pagination" aria-label="Pagination">
        <button type="button" onClick={() => setListState({ q, page: page - 1, pageSize })} disabled={page <= 1}>Previous</button>
        <span>Page {page} of {totalPages} (Total: {listQuery.data.totalRow} Services)</span>
        <button type="button" onClick={() => setListState({ q, page: page + 1, pageSize })} disabled={page >= totalPages}>Next</button>
      </nav> : null}
    </main>
  );
}

export function AdminServiceDetailRoute({ serviceId: suppliedServiceId }: { serviceId?: string } = {}) {
  const { serviceId: routeServiceId } = useParams();
  const serviceId = suppliedServiceId ?? routeServiceId ?? "";
  const { session } = useSession();
  const navigate = useNavigate();
  const location = useLocation() as ReturnType<typeof useLocation> & { state?: { adminFeedback?: string } | null };
  const heading = useRef<HTMLHeadingElement>(null);
  const detailQuery = useAdminServiceDetail(serviceId, session?.token ?? "", Boolean(session && serviceId));
  useEffect(() => { document.title = "Service Detail | Administrator"; heading.current?.focus(); }, []);
  const back = listPath(location.search);
  return <main id="main-content" className="admin-service-detail">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to={back}>Services</Link><span aria-hidden="true">/</span><span aria-current="page">Detail</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">Service record</span><h1 ref={heading} tabIndex={-1}>Service Detail</h1><p>Review Service metadata, Seller, and media.</p></div></header>
    {location.state?.adminFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{location.state.adminFeedback}</div> : null}
    {detailQuery.isPending && <div className="state-indicator" data-state="loading" role="status">Loading Service...</div>}
    {detailQuery.isError && <FailureMessage kind={kindOf(detailQuery.error)} action="load" onRetry={() => void detailQuery.refetch()} />}
    {detailQuery.data ? <div className="admin-service-detail-body">
      {detailQuery.data.imageUrl ? (
        <img src={detailQuery.data.imageUrl} alt="" className="admin-service-image-preview" />
      ) : (
        <div className="state-indicator" data-state="empty" role="status">No image uploaded.</div>
      )}
      <dl>
        <dt>Title</dt><dd>{detailQuery.data.title}</dd>
        <dt>Short Description</dt><dd>{detailQuery.data.shortDescription || "Not provided"}</dd>
        <dt>Description</dt><dd>{detailQuery.data.description || "Not provided"}</dd>
        <dt>Price</dt><dd>${detailQuery.data.price}</dd>
        <dt>Rating</dt><dd>{detailQuery.data.rating.toFixed(1)} / 5</dd>
        <dt>Review Count</dt><dd>{detailQuery.data.reviewCount} (server-tracked, not editable)</dd>
        <dt>Seller</dt><dd>{detailQuery.data.sellerName ?? `User ${detailQuery.data.sellerId}`}</dd>
        <dt>Category</dt><dd>{detailQuery.data.categoryName ?? "Not available"}</dd>
        <dt>Group</dt><dd>{detailQuery.data.groupName ?? "Not available"}</dd>
        <dt>Subcategory</dt><dd>{detailQuery.data.subcategoryName ?? "Not available"}</dd>
      </dl>
      <nav className="detail-actions" aria-label="Service detail actions"><Link to={back}>Back to list</Link>
        <Link to={withSearch(`/admin/services/${serviceId}/edit`, location.search)}>Edit Service</Link>
        <DeleteServiceControl service={detailQuery.data} visibleLabel="Delete Service" className="danger-button"
          onReloadLatest={() => void detailQuery.refetch()} onDeleted={() => navigate(back, { replace: true, state: { adminFeedback: `Service ${detailQuery.data?.title ?? ""} deleted successfully.` } })} />
      </nav>
    </div> : null}
  </main>;
}

export function AdminServiceCreateRoute() {
  const { session } = useSession();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const mutation = useCreateAdminService(session?.token ?? "");
  const taxonomyQuery = useTaxonomy();
  useEffect(() => { document.title = "Create Service | Administrator"; heading.current?.focus(); }, []);
  const save = async (form: ServiceFormState) => {
    try {
      const created = await mutation.mutateAsync(toCreateInput(form));
      navigate("/admin/services", {
        replace: true,
        state: { adminFeedback: `Service "${created.title}" created successfully.`, createdServiceId: created.id },
      });
    } catch { /* rendered locally */ }
  };
  return <main id="main-content" className="admin-service-create">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to="/admin/services">Services</Link><span aria-hidden="true">/</span><span aria-current="page">Create</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">New listing</span><h1 ref={heading} tabIndex={-1}>Create Service</h1><p>Add a validated Service. Images can be uploaded after the Service is created.</p></div></header>
    {mutation.isPending && <div className="state-indicator" data-state="pending" role="status">Creating Service...</div>}
    {mutation.isError && <FailureMessage kind={kindOf(mutation.error)} action="create" />}
    {taxonomyQuery.isError && <FailureMessage kind="unknown" action="load categories for" onRetry={() => void taxonomyQuery.refetch()} />}
    <ServiceForm initialValue={emptyForm()} categories={taxonomyQuery.data ?? []} categoriesPending={taxonomyQuery.isPending}
      pending={mutation.isPending} submitLabel="Create Service" idPrefix="create" cancelTo="/admin/services" onSubmit={save} />
  </main>;
}

export function AdminServiceEditRoute({ serviceId: suppliedServiceId }: { serviceId?: string } = {}) {
  const { serviceId: routeServiceId } = useParams();
  const serviceId = suppliedServiceId ?? routeServiceId ?? "";
  const { session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  const detailQuery = useAdminServiceDetail(serviceId, session?.token ?? "", Boolean(session && serviceId));
  const taxonomyQuery = useTaxonomy();
  const mutation = useUpdateAdminService(session?.token ?? "");
  const evidence = useAdminServiceSafeguardEvidence(session?.token ?? "");
  const [feedback, setFeedback] = useState<GuardFeedback | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [pendingTransfer, setPendingTransfer] = useState<{ input: UpdateServiceInput; sellerEmail: string; sellerName: string } | null>(null);
  const [reconcileInput, setReconcileInput] = useState<UpdateServiceInput | null>(null);
  const [checking, setChecking] = useState(false);
  const back = listPath(location.search);

  useEffect(() => { document.title = "Edit Service | Administrator"; heading.current?.focus(); }, []);

  const baseline = detailQuery.data;
  const categories = taxonomyQuery.data ?? [];
  const formKey = useMemo(
    () => (baseline ? `${serviceEvidence(baseline)}::${categories.length}` : "loading"),
    [baseline, categories.length],
  );

  const reloadLatest = async () => {
    setFeedback(null);
    setPendingTransfer(null);
    setReconcileInput(null);
    setConfirmation("");
    await detailQuery.refetch();
  };

  const reconcileUpdate = async (input: UpdateServiceInput) => {
    setChecking(true);
    try {
      const current = await evidence.refetchTarget(serviceId);
      if (serviceMatchesUpdate(current, input)) {
        setReconcileInput(null);
        navigate(withSearch(`/admin/services/${serviceId}`, location.search), {
          replace: true,
          state: { adminFeedback: `Service ${current.title} updated successfully after reconciliation.` },
        });
      } else if (baseline && sameServiceEvidence(current, baseline)) {
        setFeedback({ state: "unknown-outcome", message: "Update was not confirmed. Latest evidence is unchanged; you may retry the saved form after reconciliation." });
      } else {
        setReconcileInput(null);
        setFeedback({ state: "stale", message: "This Service changed after you opened the form. Reload latest before updating." });
      }
    } catch {
      setFeedback({ state: "unknown-outcome", message: "Could not reconcile the update outcome. Check latest before retrying." });
    } finally {
      setChecking(false);
    }
  };

  const performUpdate = async (input: UpdateServiceInput) => {
    if (!baseline) return;
    setChecking(true);
    setFeedback(null);
    setReconcileInput(input);
    try {
      const fresh = await evidence.refetchTarget(serviceId);
      if (!sameServiceEvidence(fresh, baseline)) {
        setReconcileInput(null);
        setFeedback({ state: "stale", message: "This Service changed after you opened the form. Reload latest before updating." });
        return;
      }
      await mutation.mutateAsync({ id: serviceId, input });
      setReconcileInput(null);
      navigate(withSearch(`/admin/services/${serviceId}`, location.search), {
        replace: true,
        state: { adminFeedback: `Service ${fresh.title} updated successfully.` },
      });
    } catch (error) {
      if (kindOf(error) === "unknown_outcome") {
        setFeedback({ state: "unknown-outcome", message: "Update outcome is unknown. Reconciling against the latest Service evidence..." });
        await reconcileUpdate(input);
      }
    } finally {
      setChecking(false);
    }
  };

  const save = async (form: ServiceFormState) => {
    if (!baseline) return;
    const input = toUpdateInput(baseline, form);
    const sellerChanged = input.sellerId !== baseline.sellerId;
    if (sellerChanged) {
      const sellerEmail = form.seller?.email.trim() ?? "";
      if (!sellerEmail) {
        setFeedback({ state: "blocked-dependency", message: "Ownership transfer is blocked because the new Seller has no email for typed confirmation." });
        return;
      }
      setFeedback(null);
      setPendingTransfer({ input, sellerEmail, sellerName: form.seller?.name ?? "" });
      setConfirmation("");
      return;
    }
    await performUpdate(input);
  };

  const pending = checking || mutation.isPending;
  return <main id="main-content" className="admin-service-edit">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to={back}>Services</Link><span aria-hidden="true">/</span><span aria-current="page">Edit</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">Catalog settings</span><h1 ref={heading} tabIndex={-1}>Edit Service</h1><p>Update approved Service information, pricing, and Seller assignment.</p></div></header>
    {detailQuery.isPending && <div className="state-indicator" data-state="loading" role="status">Loading Service...</div>}
    {detailQuery.isError && <FailureMessage kind={kindOf(detailQuery.error)} action="load" onRetry={() => void detailQuery.refetch()} />}
    {pending && <div className="state-indicator" data-state="pending" role="status">Checking latest evidence and updating Service...</div>}
    {feedback ? <GuardMessage feedback={feedback} onReload={() => void reloadLatest()}
      onReconcile={reconcileInput ? () => void reconcileUpdate(reconcileInput) : undefined} /> : null}
    {mutation.isError && kindOf(mutation.error) !== "unknown_outcome" ? <FailureMessage kind={kindOf(mutation.error)} action="update" /> : null}
    {baseline ? <>
      <ServiceForm key={formKey} initialValue={formFromService(baseline, categories)} categories={categories}
        categoriesPending={taxonomyQuery.isPending} pending={pending}
        submitLabel="Save Changes" idPrefix="edit" cancelTo={back} onSubmit={save} />
      <ServiceImageUpload serviceId={baseline.id} currentImageUrl={baseline.imageUrl} />
      <div className="edit-destructive-actions" aria-label="Edit Service destructive actions">
        <DeleteServiceControl service={baseline} visibleLabel="Delete Service" className="danger-button"
          onReloadLatest={() => void reloadLatest()} onDeleted={() => navigate(back, { replace: true, state: { adminFeedback: `Service ${baseline.title} deleted successfully.` } })} />
      </div>
      {pendingTransfer ? <TypedConfirmationDialog subjectId={baseline.id} subjectLabel={baseline.title}
        confirmField={{ label: "New Seller's email", value: pendingTransfer.sellerEmail }}
        title={`Confirm ownership transfer for ${baseline.title}?`}
        description={`This reassigns the Service from ${baseline.sellerName ?? `User ${baseline.sellerId}`} to ${pendingTransfer.sellerName}.`}
        actionLabel="Confirm Changes" pendingLabel="Updating..." pending={pending}
        confirmation={confirmation} onConfirmationChange={setConfirmation}
        onCancel={() => { setPendingTransfer(null); setConfirmation(""); }}
        onConfirm={() => { const input = pendingTransfer.input; setPendingTransfer(null); void performUpdate(input); }} /> : null}
    </> : null}
  </main>;
}
