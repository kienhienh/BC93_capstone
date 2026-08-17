import type { AdminCategoryHierarchy, AdminServiceCategory } from "./capability";
import { normalizeCategoryName } from "./validation";

export type GuardFeedback = {
  state: "blocked-dependency" | "stale" | "unknown-outcome";
  message: string;
};

export function sameCategoryEvidence(left: AdminServiceCategory, right: AdminServiceCategory) {
  return left.id === right.id && left.name === right.name;
}

export function categoryMatchesName(category: AdminServiceCategory, name: string) {
  return category.name === normalizeCategoryName(name);
}

export function dependencySummary(hierarchy: AdminCategoryHierarchy) {
  const groupCount = hierarchy.groups.length;
  const subcategoryCount = hierarchy.groups.reduce((total, group) => total + group.subcategories.length, 0);
  return { groupCount, subcategoryCount, hasDependencies: groupCount > 0 || subcategoryCount > 0 };
}

export function duplicateCategory(
  categories: readonly AdminServiceCategory[],
  name: string,
  excludeId?: string,
) {
  const normalized = normalizeCategoryName(name).toLocaleLowerCase();
  return categories.find((category) =>
    category.id !== excludeId && normalizeCategoryName(category.name).toLocaleLowerCase() === normalized,
  ) ?? null;
}
