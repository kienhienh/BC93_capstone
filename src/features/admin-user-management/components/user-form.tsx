import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AdminUser } from "../capability";
import { isCanonicalRole, type UserFormState } from "../user-form-model";
import { LegacyRoleWarning } from "./feedback";
import { UnsavedChangesDialog } from "./dialogs";

export function UserForm({
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
