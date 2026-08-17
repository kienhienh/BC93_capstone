import type { AdminService, CreateServiceInput, UpdateServiceInput } from "./capability";
import type { ServiceCategory } from "../taxonomy/wiring";

export type SellerRef = { id: string; name: string; email: string };

export type TaxonomySelection = { categoryId: string; groupId: string; subcategoryId: string };

export type ServiceFormState = {
  title: string;
  shortDescription: string;
  description: string;
  price: string;
  rating: string;
  seller: SellerRef | null;
} & TaxonomySelection;

export function findTaxonomyPath(categories: readonly ServiceCategory[], subcategoryId: string): TaxonomySelection {
  for (const category of categories) {
    for (const group of category.groups) {
      const subcategory = group.subcategories.find((item) => item.id === subcategoryId);
      if (subcategory) return { categoryId: category.id, groupId: group.id, subcategoryId: subcategory.id };
    }
  }
  return { categoryId: "", groupId: "", subcategoryId };
}

export function toCreateInput(form: ServiceFormState): CreateServiceInput {
  return {
    title: form.title.trim(),
    shortDescription: form.shortDescription.trim(),
    description: form.description.trim(),
    price: Number(form.price),
    sellerId: form.seller?.id ?? "",
    subcategoryId: form.subcategoryId,
    rating: Number(form.rating),
  };
}

export function toUpdateInput(baseline: AdminService, form: ServiceFormState): UpdateServiceInput {
  return { ...toCreateInput(form), reviewCount: baseline.reviewCount };
}

export function emptyForm(): ServiceFormState {
  return {
    title: "",
    shortDescription: "",
    description: "",
    price: "",
    rating: "0",
    seller: null,
    categoryId: "",
    groupId: "",
    subcategoryId: "",
  };
}

export function formFromService(service: AdminService, categories: readonly ServiceCategory[]): ServiceFormState {
  const path = findTaxonomyPath(categories, service.subcategoryId);
  return {
    title: service.title,
    shortDescription: service.shortDescription,
    description: service.description,
    price: String(service.price),
    rating: String(service.rating),
    seller: { id: service.sellerId, name: service.sellerName ?? `User ${service.sellerId}`, email: "" },
    ...path,
  };
}
