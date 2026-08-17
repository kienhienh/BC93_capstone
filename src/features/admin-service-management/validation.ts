export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ServiceFormFields = {
  title: string;
  shortDescription: string;
  description: string;
  price: string;
  rating: string;
  sellerId: string;
  subcategoryId: string;
};

export function validateServiceForm(values: ServiceFormFields) {
  const errors: Partial<Record<keyof ServiceFormFields, string>> = {};
  const title = values.title.trim();
  if (!title) errors.title = "Title is required.";
  else if (title.length < 5 || title.length > 100) errors.title = "Title must contain 5–100 characters.";

  const shortDescription = values.shortDescription.trim();
  if (!shortDescription) errors.shortDescription = "Short description is required.";

  const description = values.description.trim();
  if (!description) errors.description = "Description is required.";

  const price = Number(values.price);
  if (!Number.isFinite(price) || price <= 0) errors.price = "Enter a price greater than 0.";

  const rating = Number(values.rating);
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) errors.rating = "Rating must be between 0 and 5.";

  if (!values.sellerId) errors.sellerId = "Choose a Seller from existing Users.";
  if (!values.subcategoryId) errors.subcategoryId = "Choose a category and subcategory.";

  if (Object.keys(errors).length) return { ok: false as const, errors };
  return {
    ok: true as const,
    input: { title, shortDescription, description, price, rating, sellerId: values.sellerId, subcategoryId: values.subcategoryId },
  };
}

export function validateServiceImage(file: File): { ok: true } | { ok: false; message: string } {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return { ok: false, message: "Choose a JPEG, PNG, or WebP image." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: "Choose an image 5 MB or smaller." };
  }
  return { ok: true };
}
