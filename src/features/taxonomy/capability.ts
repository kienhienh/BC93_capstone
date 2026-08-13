export interface ServiceSubcategory {
  id: string;
  name: string;
}

export interface ServiceGroup {
  id: string;
  name: string;
  imageUrl: string | null;
  subcategories: readonly ServiceSubcategory[];
}

export interface ServiceCategory {
  id: string;
  name: string;
  groups: readonly ServiceGroup[];
}

export type TaxonomyFailureKind =
  | "cancelled"
  | "malformed"
  | "offline"
  | "network"
  | "server"
  | "unknown";

export class TaxonomyFailure extends Error {
  readonly kind: TaxonomyFailureKind;

  constructor(kind: TaxonomyFailureKind) {
    super("The Service taxonomy request failed.");
    this.name = "TaxonomyFailure";
    this.kind = kind;
  }
}

export interface TaxonomyCapability {
  listCategories(signal: AbortSignal): Promise<readonly ServiceCategory[]>;
}
