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

export function TypedCategoryDeleteDialog({ categoryId, categoryName, pending, confirmation, onConfirmationChange, onCancel, onConfirm }: {
  categoryId: string;
  categoryName: string;
  pending: boolean;
  confirmation: string;
  onConfirmationChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const prefix = `delete-category-${categoryId}`;
  const matches = confirmation === categoryName;
  return <AccessibleDialog titleId={`${prefix}-title`} descriptionId={`${prefix}-description`}
    initialFocusRef={cancelRef} onCancel={onCancel} pending={pending}>
    <h2 id={`${prefix}-title`}>Delete Service Category?</h2>
    <p id={`${prefix}-description`}>
      The latest Category and its Group/Subcategory dependencies will be checked before deletion. No cascade, reparenting, or cleanup will be performed.
    </p>
    <div className="confirmation-field">
      <label htmlFor={`${prefix}-value`}>Type {categoryName} to confirm</label>
      <input id={`${prefix}-value`} value={confirmation} disabled={pending} autoComplete="off"
        onChange={(event) => onConfirmationChange(event.target.value)} />
      <small>Service Category name</small>
    </div>
    <div className="dialog-actions">
      <button ref={cancelRef} className="secondary-button" type="button" onClick={onCancel} disabled={pending}
        aria-label={`Cancel delete for ${categoryName}`}>Cancel</button>
      <button className="danger-button" type="button" onClick={onConfirm} disabled={pending || !matches}
        aria-label={`Delete ${categoryName}`}>{pending ? "Checking..." : "Delete Category"}</button>
    </div>
  </AccessibleDialog>;
}

export function UnsavedChangesDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  const stayRef = useRef<HTMLButtonElement>(null);
  return <AccessibleDialog titleId="category-unsaved-title" descriptionId="category-unsaved-description"
    initialFocusRef={stayRef} onCancel={onStay}>
    <h2 id="category-unsaved-title">Leave with unsaved changes?</h2>
    <p id="category-unsaved-description">Your non-secret Service Category name change will be discarded.</p>
    <div className="dialog-actions">
      <button ref={stayRef} type="button" className="secondary-button" onClick={onStay}>Stay and keep editing</button>
      <button type="button" className="danger-button" onClick={onLeave}>Leave without saving</button>
    </div>
  </AccessibleDialog>;
}
