import type { AdminService, UpdateServiceInput } from "./capability";

export type GuardFeedback = {
  state: "blocked-dependency" | "stale" | "unknown-outcome";
  message: string;
};

export function serviceEvidence(service: AdminService) {
  return JSON.stringify({
    id: service.id,
    title: service.title,
    description: service.description,
    shortDescription: service.shortDescription,
    price: service.price,
    imageUrl: service.imageUrl,
    rating: service.rating,
    reviewCount: service.reviewCount,
    sellerId: service.sellerId,
    subcategoryId: service.subcategoryId,
  });
}

export function sameServiceEvidence(left: AdminService, right: AdminService) {
  return serviceEvidence(left) === serviceEvidence(right);
}

export function serviceMatchesUpdate(service: AdminService, input: UpdateServiceInput) {
  return (
    service.title === input.title
    && service.description === input.description
    && service.shortDescription === input.shortDescription
    && service.price === input.price
    && service.sellerId === input.sellerId
    && service.subcategoryId === input.subcategoryId
    && service.rating === input.rating
  );
}
