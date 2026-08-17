import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UnsavedChangesDialog } from "./dialogs";
import { normalizeCommentContent, validateCommentContent, validateCommentRating } from "../validation";
import type { AdminCommentServiceRef } from "../capability";

export function CommentForm({
  idPrefix, pending, submitLabel, cancelTo, serverError, onClearServerError, onSubmit,
  initialContent, initialRating, serviceField,
}: {
  idPrefix: string;
  pending: boolean;
  submitLabel: string;
  cancelTo: string;
  serverError?: string | null;
  onClearServerError: () => void;
  onSubmit: (content: string, rating: number) => Promise<boolean>;
  initialContent: string;
  initialRating: number;
  serviceField?: {
    services: readonly AdminCommentServiceRef[];
    value: string;
    onChange: (serviceId: string) => void;
    error?: string | null;
  };
}) {
  const navigate = useNavigate();
  const [content, setContent] = useState(initialContent);
  const [rating, setRating] = useState(initialRating);
  const [localError, setLocalError] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const error = localError ?? serverError ?? null;

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
    const contentValidation = validateCommentContent(content);
    const ratingValidation = validateCommentRating(rating);
    if (serviceField && !serviceField.value) {
      queueMicrotask(() => document.getElementById(`${idPrefix}-service`)?.focus());
      return;
    }
    if (contentValidation) {
      setLocalError(contentValidation);
      setRatingError(null);
      queueMicrotask(() => document.getElementById(`${idPrefix}-content`)?.focus());
      return;
    }
    if (ratingValidation) {
      setLocalError(null);
      setRatingError(ratingValidation);
      queueMicrotask(() => document.getElementById(`${idPrefix}-rating`)?.focus());
      return;
    }
    setLocalError(null);
    setRatingError(null);
    if (await onSubmit(normalizeCommentContent(content), rating)) setDirty(false);
  };

  return <>
    <form className="admin-comment-form" onSubmit={submit} noValidate aria-busy={pending}>
      {serviceField ? <div className="form-field">
        <label htmlFor={`${idPrefix}-service`}>Service *</label>
        <select id={`${idPrefix}-service`} value={serviceField.value} disabled={pending}
          aria-invalid={Boolean(serviceField.error)}
          onChange={(event) => { serviceField.onChange(event.target.value); setDirty(true); }}>
          <option value="">Select a Service...</option>
          {serviceField.services.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}
        </select>
        {serviceField.error ? <div className="error-message" role="alert" data-state="validation-failure">{serviceField.error}</div> : null}
      </div> : null}
      <div className="form-field">
        <label htmlFor={`${idPrefix}-content`}>Comment content *</label>
        <textarea id={`${idPrefix}-content`} value={content} required maxLength={1000} disabled={pending}
          aria-invalid={Boolean(error)} aria-describedby={error ? `${idPrefix}-content-error` : undefined}
          onChange={(event) => {
            setContent(event.target.value);
            setDirty(true);
            setLocalError(null);
            onClearServerError();
          }} />
        {error ? <div id={`${idPrefix}-content-error`} className="error-message" role="alert" data-state="validation-failure">{error}</div> : null}
      </div>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-rating`}>Rating (0-5) *</label>
        <input id={`${idPrefix}-rating`} type="number" min={0} max={5} step={1} value={rating} disabled={pending}
          aria-invalid={Boolean(ratingError)} aria-describedby={ratingError ? `${idPrefix}-rating-error` : undefined}
          onChange={(event) => { setRating(Number(event.target.value)); setDirty(true); setRatingError(null); }} />
        {ratingError ? <div id={`${idPrefix}-rating-error`} className="error-message" role="alert" data-state="validation-failure">{ratingError}</div> : null}
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
