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

export function CompleteHiredServiceDialog({ hiredServiceId, pending, onCancel, onConfirm }: {
  hiredServiceId: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const prefix = `complete-hired-service-${hiredServiceId}`;
  return <AccessibleDialog titleId={`${prefix}-title`} descriptionId={`${prefix}-description`}
    initialFocusRef={cancelRef} onCancel={onCancel} pending={pending}>
    <h2 id={`${prefix}-title`}>Complete Hired Service {hiredServiceId}?</h2>
    <p id={`${prefix}-description`}>
      The latest status will be checked before completing. This cannot be rolled back.
    </p>
    <div className="dialog-actions">
      <button ref={cancelRef} className="secondary-button" type="button" onClick={onCancel} disabled={pending}>Go back</button>
      <button className="primary-button" type="button" onClick={onConfirm} disabled={pending}
        aria-label={`Complete Hired Service ${hiredServiceId}`}>{pending ? "Checking..." : "Complete Hired Service"}</button>
    </div>
  </AccessibleDialog>;
}

export function CancelHiredServiceDialog({ hiredServiceId, pending, onCancel, onConfirm }: {
  hiredServiceId: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const prefix = `cancel-hired-service-${hiredServiceId}`;
  return <AccessibleDialog titleId={`${prefix}-title`} descriptionId={`${prefix}-description`}
    initialFocusRef={cancelRef} onCancel={onCancel} pending={pending}>
    <h2 id={`${prefix}-title`}>Cancel Hired Service {hiredServiceId}?</h2>
    <p id={`${prefix}-description`}>
      The latest status will be checked before cancelling. The record will be removed with no
      cancellation history, reason, or undo.
    </p>
    <div className="dialog-actions">
      <button ref={cancelRef} className="secondary-button" type="button" onClick={onCancel} disabled={pending}>Go back</button>
      <button className="danger-button" type="button" onClick={onConfirm} disabled={pending}
        aria-label={`Cancel Hired Service ${hiredServiceId}`}>{pending ? "Checking..." : "Cancel Hired Service"}</button>
    </div>
  </AccessibleDialog>;
}
