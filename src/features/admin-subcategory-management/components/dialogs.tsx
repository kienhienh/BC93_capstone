import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
  ));
}

export function AccessibleDialog({ titleId, descriptionId, initialFocusRef, onCancel, pending = false, children }: {
  titleId: string;
  descriptionId: string;
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

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
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

  return <div className="admin-dialog-backdrop" role="presentation">
    <div ref={dialogRef} className="admin-confirmation-dialog" role="dialog" aria-modal="true"
      aria-labelledby={titleId} aria-describedby={descriptionId} onKeyDown={onKeyDown}>
      {children}
    </div>
  </div>;
}

export function TypedSubcategoryDeleteDialog({ subcategoryId, subcategoryName, pending, confirmation, onConfirmationChange, onCancel, onConfirm }: {
  subcategoryId: string;
  subcategoryName: string;
  pending: boolean;
  confirmation: string;
  onConfirmationChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const prefix = `delete-subcategory-${subcategoryId}`;
  const matches = confirmation === subcategoryName;
  return <AccessibleDialog titleId={`${prefix}-title`} descriptionId={`${prefix}-description`}
    initialFocusRef={cancelRef} onCancel={onCancel} pending={pending}>
    <h2 id={`${prefix}-title`}>Delete Service Subcategory?</h2>
    <p id={`${prefix}-description`}>
      The latest Subcategory and its Service Group membership will be checked before deletion. No cascade, reparenting, or cleanup will be performed.
    </p>
    <div className="confirmation-field">
      <label htmlFor={`${prefix}-value`}>Type {subcategoryName} to confirm</label>
      <input id={`${prefix}-value`} value={confirmation} disabled={pending} autoComplete="off"
        onChange={(event) => onConfirmationChange(event.target.value)} />
      <small>Service Subcategory name</small>
    </div>
    <div className="dialog-actions">
      <button ref={cancelRef} className="secondary-button" type="button" onClick={onCancel} disabled={pending}
        aria-label={`Cancel delete for ${subcategoryName}`}>Cancel</button>
      <button className="danger-button" type="button" onClick={onConfirm} disabled={pending || !matches}
        aria-label={`Delete ${subcategoryName}`}>{pending ? "Checking..." : "Delete Subcategory"}</button>
    </div>
  </AccessibleDialog>;
}

export function GroupMembershipReviewDialog({ categoryName, groupName, added, removed, unchanged, pending, onCancel, onConfirm }: {
  categoryName: string;
  groupName: string;
  added: readonly string[];
  removed: readonly string[];
  unchanged: readonly string[];
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  return <AccessibleDialog titleId="group-membership-review-title" descriptionId="group-membership-review-description"
    initialFocusRef={confirmRef} onCancel={onCancel} pending={pending}>
    <h2 id="group-membership-review-title">Review Service Group membership?</h2>
    <p id="group-membership-review-description">
      Confirm the Service Category, Service Group, and Service Subcategory relationships before saving. No automatic reassignment from another Service Group is performed.
    </p>
    <dl className="group-review-summary">
      <div><dt>Service Category</dt><dd>{categoryName}</dd></div>
      <div><dt>Service Group</dt><dd>{groupName}</dd></div>
    </dl>
    {added.length ? <div><h3>Adding</h3><ul>{added.map((name) => <li key={name}>{name}</li>)}</ul></div> : null}
    {removed.length ? <div><h3>Removing</h3><ul>{removed.map((name) => <li key={name}>{name}</li>)}</ul></div> : null}
    {unchanged.length ? <div><h3>Unchanged</h3><ul>{unchanged.map((name) => <li key={name}>{name}</li>)}</ul></div> : null}
    {!added.length && !removed.length && !unchanged.length ? <p>No Service Subcategories are selected for this Service Group.</p> : null}
    <div className="dialog-actions">
      <button className="secondary-button" type="button" onClick={onCancel} disabled={pending}>Cancel</button>
      <button ref={confirmRef} className="admin-primary-action" type="button" onClick={onConfirm} disabled={pending}>
        {pending ? "Saving..." : "Confirm & save"}
      </button>
    </div>
  </AccessibleDialog>;
}

export function UnsavedChangesDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  const stayRef = useRef<HTMLButtonElement>(null);
  return <AccessibleDialog titleId="subcategory-unsaved-title" descriptionId="subcategory-unsaved-description"
    initialFocusRef={stayRef} onCancel={onStay}>
    <h2 id="subcategory-unsaved-title">Leave with unsaved changes?</h2>
    <p id="subcategory-unsaved-description">Your non-secret changes will be discarded.</p>
    <div className="dialog-actions">
      <button ref={stayRef} type="button" className="secondary-button" onClick={onStay}>Stay and keep editing</button>
      <button type="button" className="danger-button" onClick={onLeave}>Leave without saving</button>
    </div>
  </AccessibleDialog>;
}
