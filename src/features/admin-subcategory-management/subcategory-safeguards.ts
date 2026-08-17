import type { AdminCategoryHierarchy, AdminServiceGroup, AdminSubcategory } from "./capability";
import { normalizeGroupName, normalizeSubcategoryName } from "./validation";

export type GuardFeedback = {
  state: "blocked-dependency" | "stale" | "unknown-outcome";
  message: string;
};

export type MembershipRecord = {
  categoryId: string;
  categoryName: string;
  groupId: string;
  groupName: string;
};

export function sameSubcategoryEvidence(left: AdminSubcategory, right: AdminSubcategory) {
  return left.id === right.id && left.name === right.name;
}

export function duplicateSubcategory(
  subcategories: readonly AdminSubcategory[],
  name: string,
  excludeId?: string,
) {
  const normalized = normalizeSubcategoryName(name).toLocaleLowerCase();
  return subcategories.find((subcategory) =>
    subcategory.id !== excludeId && normalizeSubcategoryName(subcategory.name).toLocaleLowerCase() === normalized,
  ) ?? null;
}

export function duplicateGroupName(
  hierarchy: AdminCategoryHierarchy,
  name: string,
  excludeGroupId?: string,
) {
  const normalized = normalizeGroupName(name).toLocaleLowerCase();
  return hierarchy.groups.find((group) =>
    group.id !== excludeGroupId && normalizeGroupName(group.name).toLocaleLowerCase() === normalized,
  ) ?? null;
}

export function buildMembershipIndex(hierarchies: readonly AdminCategoryHierarchy[]) {
  const index = new Map<string, MembershipRecord>();
  for (const hierarchy of hierarchies) {
    for (const group of hierarchy.groups) {
      for (const subcategory of group.subcategories) {
        index.set(subcategory.id, {
          categoryId: hierarchy.categoryId,
          categoryName: hierarchy.categoryName,
          groupId: group.id,
          groupName: group.name,
        });
      }
    }
  }
  return index;
}

export function foreignMemberships(
  subcategoryIds: readonly string[],
  membershipIndex: ReadonlyMap<string, MembershipRecord>,
  ownGroupId: string | null,
) {
  const conflicts: Array<{ subcategoryId: string; record: MembershipRecord }> = [];
  for (const id of subcategoryIds) {
    const record = membershipIndex.get(id);
    if (record && record.groupId !== ownGroupId) conflicts.push({ subcategoryId: id, record });
  }
  return conflicts;
}

export function sameGroupEvidence(left: AdminServiceGroup, right: AdminServiceGroup) {
  if (left.id !== right.id || left.name !== right.name) return false;
  const leftIds = [...left.subcategories.map((item) => item.id)].sort();
  const rightIds = [...right.subcategories.map((item) => item.id)].sort();
  return leftIds.length === rightIds.length && leftIds.every((id, index) => id === rightIds[index]);
}

export function membershipDiff(baseline: readonly string[], next: readonly string[]) {
  const baselineSet = new Set(baseline);
  const nextSet = new Set(next);
  return {
    added: next.filter((id) => !baselineSet.has(id)),
    removed: baseline.filter((id) => !nextSet.has(id)),
  };
}
