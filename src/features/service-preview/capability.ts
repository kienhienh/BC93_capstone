export interface ServicePreview {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string | null;
  rating: number | null;
}

export type ServicePreviewFailureKind =
  | "cancelled"
  | "malformed"
  | "offline"
  | "network"
  | "server"
  | "unknown";

export class ServicePreviewFailure extends Error {
  readonly kind: ServicePreviewFailureKind;

  constructor(kind: ServicePreviewFailureKind, message: string) {
    super(message);
    this.name = "ServicePreviewFailure";
    this.kind = kind;
  }
}

export interface ServicePreviewCapability {
  listServices(signal: AbortSignal): Promise<ServicePreview[]>;
}
