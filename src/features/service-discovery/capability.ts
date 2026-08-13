export interface ServiceDiscoveryItem {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string | null;
  rating: number | null;
  commentCount: number | null;
  sellerName: string | null;
  sellerAvatarUrl: string | null;
}

export type ServiceDiscoveryFailureKind =
  | "cancelled"
  | "malformed"
  | "offline"
  | "network"
  | "server"
  | "unknown";

export class ServiceDiscoveryFailure extends Error {
  readonly kind: ServiceDiscoveryFailureKind;

  constructor(kind: ServiceDiscoveryFailureKind) {
    super("The Service discovery request failed.");
    this.name = "ServiceDiscoveryFailure";
    this.kind = kind;
  }
}

export interface ServiceDiscoveryCapability {
  listServices(signal: AbortSignal): Promise<readonly ServiceDiscoveryItem[]>;
  searchServices(
    search: string,
    signal: AbortSignal,
  ): Promise<readonly ServiceDiscoveryItem[]>;
  listServicesBySubcategory(
    subcategoryId: string,
    signal: AbortSignal,
  ): Promise<readonly ServiceDiscoveryItem[]>;
}
