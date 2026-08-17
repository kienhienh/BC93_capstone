export function validateCategoryName(name: string) {
  const value = name.trim();
  if (!value) return "Service Category name is required.";
  if (value.length > 100) return "Service Category name must be 100 characters or fewer.";
  if (/\p{Cc}/u.test(value)) return "Service Category name contains unsupported control characters.";
  return null;
}

export function normalizeCategoryName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}
