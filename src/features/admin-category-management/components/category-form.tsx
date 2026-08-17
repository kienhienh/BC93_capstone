import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UnsavedChangesDialog } from "./dialogs";
import { normalizeCategoryName, validateCategoryName } from "../validation";

export function CategoryForm({ initialName, pending, submitLabel, idPrefix, cancelTo, serverNameError, onClearServerNameError, onSubmit }: {
  initialName: string;
  pending: boolean;
  submitLabel: string;
  idPrefix: string;
  cancelTo: string;
  serverNameError?: string | null;
  onClearServerNameError: () => void;
  onSubmit: (name: string) => Promise<boolean>;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState(initialName);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const error = localError ?? serverNameError ?? null;

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateCategoryName(name);
    if (validation) {
      setLocalError(validation);
      queueMicrotask(() => document.getElementById(`${idPrefix}-name`)?.focus());
      return;
    }
    setLocalError(null);
    if (await onSubmit(normalizeCategoryName(name))) setDirty(false);
  };

  return <>
    <form className="admin-category-form" onSubmit={submit} noValidate aria-busy={pending}>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-name`}>Service Category name *</label>
        <input id={`${idPrefix}-name`} value={name} required maxLength={100} disabled={pending}
          aria-invalid={Boolean(error)} aria-describedby={error ? `${idPrefix}-name-error` : `${idPrefix}-name-help`}
          onChange={(event) => {
            setName(event.target.value);
            setDirty(true);
            setLocalError(null);
            onClearServerNameError();
          }} />
        <small id={`${idPrefix}-name-help`}>Use the canonical marketplace name. Duplicate names are not allowed.</small>
        {error ? <div id={`${idPrefix}-name-error`} className="error-message" role="alert" data-state="validation-failure">{error}</div> : null}
      </div>
      <div className="form-actions">
        <button type="submit" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
        <Link to={cancelTo}>Cancel</Link>
      </div>
    </form>
    {pendingNavigation ? <UnsavedChangesDialog onStay={() => setPendingNavigation(null)} onLeave={() => {
      const destination = pendingNavigation;
      setDirty(false);
      setPendingNavigation(null);
      queueMicrotask(() => navigate(destination));
    }} /> : null}
  </>;
}
