export type ServiceDetailFailureKind =
  | "cancelled"
  | "malformed"
  | "not_found"
  | "offline"
  | "network"
  | "server"
  | "unknown";

export class ServiceDetailFailure extends Error {
  readonly kind: ServiceDetailFailureKind;

  constructor(
    kind: ServiceDetailFailureKind,
    message: string,
  ) {
    super(message);
    this.kind = kind;
    this.name = "ServiceDetailFailure";
  }
}

export interface ServiceSellerSummary {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface ServiceDetail {
  id: string;
  title: string;
  description: string;
  shortDescription: string | null;
  price: number;
  imageUrl: string | null;
  rating: number | null;
  ratingCount: number | null;
  categoryName: string | null;
  groupName: string | null;
  subcategoryName: string | null;
  seller: ServiceSellerSummary | null;
}

export interface ServiceComment {
  id: string;
  authorName: string | null;
  avatarUrl: string | null;
  content: string;
  rating: number | null;
  createdAt: string | null;
}

export interface ServiceDetailCapability {
  getService(serviceId: string, signal: AbortSignal): Promise<ServiceDetail>;
  listComments(serviceId: string, signal: AbortSignal): Promise<ServiceComment[]>;
}
