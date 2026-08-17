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

export function AccessibleDialog({
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

export function TypedConfirmationDialog({
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

export function UnsavedChangesDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
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
