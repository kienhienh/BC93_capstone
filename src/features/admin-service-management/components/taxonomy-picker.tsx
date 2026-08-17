import type { ServiceCategory } from "../../taxonomy/wiring";
import type { TaxonomySelection } from "../service-form-model";

export function TaxonomyPicker({
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
