export function validateCommentContent(content: string) {
  const value = content.trim();
  if (!value) return "Comment content is required.";
  if (value.length > 1000) return "Comment content must be 1000 characters or fewer.";
  if (/\p{Cc}/u.test(value)) return "Comment content contains unsupported control characters.";
  return null;
}

export function normalizeCommentContent(content: string) {
  return content.trim();
}

export function validateCommentRating(rating: number) {
  if (!Number.isInteger(rating) || rating < 0 || rating > 5) return "Rating must be a whole number from 0 to 5.";
  return null;
}
