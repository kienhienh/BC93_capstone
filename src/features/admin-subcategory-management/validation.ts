export function validateSubcategoryName(name: string) {
  const value = name.trim();
  if (!value) return "Service Subcategory name is required.";
  if (value.length > 100) return "Service Subcategory name must be 100 characters or fewer.";
  if (/\p{Cc}/u.test(value)) return "Service Subcategory name contains unsupported control characters.";
  return null;
}

export function normalizeSubcategoryName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function validateGroupName(name: string) {
  const value = name.trim();
  if (!value) return "Service Group name is required.";
  if (value.length > 100) return "Service Group name must be 100 characters or fewer.";
  if (/\p{Cc}/u.test(value)) return "Service Group name contains unsupported control characters.";
  return null;
}

export function normalizeGroupName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}
