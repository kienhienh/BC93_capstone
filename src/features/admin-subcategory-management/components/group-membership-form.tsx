import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { GroupMembershipReviewDialog } from "./dialogs";
import { membershipDiff, type MembershipRecord } from "../subcategory-safeguards";
import { normalizeGroupName, validateGroupName } from "../validation";
import type { AdminSubcategory } from "../capability";

export function GroupMembershipForm({
  idPrefix, categoryName, initialGroupName, allSubcategories, initialSelectedIds, ownGroupId,
  membershipIndex, pending, submitLabel, cancelTo, serverNameError, onClearServerNameError, onSubmit,
}: {
  idPrefix: string;
  categoryName: string;
  initialGroupName: string;
  allSubcategories: readonly AdminSubcategory[];
  initialSelectedIds: readonly string[];
  ownGroupId: string | null;
  membershipIndex: ReadonlyMap<string, MembershipRecord>;
  pending: boolean;
  submitLabel: string;
  cancelTo: string;
  serverNameError?: string | null;
  onClearServerNameError: () => void;
  onSubmit: (name: string, subcategoryIds: readonly string[]) => Promise<boolean>;
}) {
  const [name, setName] = useState(initialGroupName);
  const [selected, setSelected] = useState(() => new Set(initialSelectedIds));
  const [localError, setLocalError] = useState<string | null>(null);
  const [review, setReview] = useState<{ name: string; ids: string[] } | null>(null);
  const error = localError ?? serverNameError ?? null;
  const nameOf = new Map(allSubcategories.map((item) => [item.id, item.name]));

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateGroupName(name);
    if (validation) {
      setLocalError(validation);
      queueMicrotask(() => document.getElementById(`${idPrefix}-name`)?.focus());
      return;
    }
    setLocalError(null);
    setReview({ name: normalizeGroupName(name), ids: [...selected] });
  };

  const confirm = async () => {
    if (!review) return;
    if (await onSubmit(review.name, review.ids)) setReview(null);
  };

  const diff = review ? membershipDiff(initialSelectedIds, review.ids) : null;

  return <>
    <form className="admin-category-form" onSubmit={submit} noValidate aria-busy={pending}>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-name`}>Service Group name *</label>
        <input id={`${idPrefix}-name`} value={name} required maxLength={100} disabled={pending}
          aria-invalid={Boolean(error)} aria-describedby={error ? `${idPrefix}-name-error` : `${idPrefix}-name-help`}
          onChange={(event) => {
            setName(event.target.value);
            setLocalError(null);
            onClearServerNameError();
          }} />
        <small id={`${idPrefix}-name-help`}>Presented as the heading/container above its Service Subcategories.</small>
        {error ? <div id={`${idPrefix}-name-error`} className="error-message" role="alert" data-state="validation-failure">{error}</div> : null}
      </div>
      <div className="form-field">
        <span className="form-static-label">Service Category</span>
        <p>{categoryName}</p>
      </div>
      <fieldset className="group-membership-picker">
        <legend>Service Subcategories</legend>
        {allSubcategories.length === 0 ? <p>No Service Subcategories exist yet. Create one first.</p> : null}
        <ul>
          {allSubcategories.map((subcategory) => {
            const record = membershipIndex.get(subcategory.id);
            const foreign = record && record.groupId !== ownGroupId;
            return <li key={subcategory.id}>
              <label>
                <input type="checkbox" disabled={pending || foreign} checked={selected.has(subcategory.id)}
                  onChange={() => toggle(subcategory.id)} />
                {subcategory.name}
              </label>
              {foreign ? <small>Already in Service Group “{record.groupName}” (Service Category “{record.categoryName}”)</small> : null}
            </li>;
          })}
        </ul>
      </fieldset>
      <div className="form-actions">
        <button type="submit" disabled={pending}>{submitLabel}</button>
        <Link to={cancelTo}>Cancel</Link>
      </div>
    </form>
    {review && diff ? <GroupMembershipReviewDialog categoryName={categoryName} groupName={review.name}
      added={diff.added.map((id) => nameOf.get(id) ?? id)}
      removed={diff.removed.map((id) => nameOf.get(id) ?? id)}
      unchanged={review.ids.filter((id) => initialSelectedIds.includes(id)).map((id) => nameOf.get(id) ?? id)}
      pending={pending} onCancel={() => setReview(null)} onConfirm={() => void confirm()} /> : null}
  </>;
}
