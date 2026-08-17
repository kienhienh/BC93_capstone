import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ServiceCategory } from "../../taxonomy/wiring";
import { validateServiceForm } from "../validation";
import type { ServiceFormState } from "../service-form-model";
import { SellerPicker } from "./seller-picker";
import { TaxonomyPicker } from "./taxonomy-picker";
import { UnsavedChangesDialog } from "./dialogs";

export function ServiceForm({
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
