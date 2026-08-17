export interface AdminServiceCategory {
  id: string;
  name: string;
}

export interface AdminCategorySubcategory {
  id: string;
  name: string;
}

export interface AdminCategoryGroup {
  id: string;
  name: string;
  imageUrl: string | null;
  subcategories: readonly AdminCategorySubcategory[];
}

export interface AdminCategoryHierarchy {
  categoryId: string;
  groups: readonly AdminCategoryGroup[];
}

export interface AdminCategoryListParams {
  pageIndex: number;
  pageSize: number;
  keyword?: string;
}

export interface AdminCategoryListResult {
  pageIndex: number;
  pageSize: number;
  totalRow: number;
  keywords: string | null;
  scope: "server" | "client-fallback";
  data: readonly AdminServiceCategory[];
}

export interface CategoryNameInput {
  name: string;
}

export type AdminCategoryManagementFailureKind =
  | "cancelled"
  | "malformed"
  | "offline"
  | "network"
  | "server"
  | "not_found"
  | "forbidden"
  | "unauthorized"
  | "validation"
  | "unknown_outcome"
  | "unknown";

export class AdminCategoryManagementFailure extends Error {
  readonly kind: AdminCategoryManagementFailureKind;

  constructor(kind: AdminCategoryManagementFailureKind) {
    super("Admin Service Category Management request failed.");
    this.name = "AdminCategoryManagementFailure";
    this.kind = kind;
  }
}

/**
 * Administrator seam over the top-level Service Category resource.
 * Group/Subcategory mutations are intentionally absent: Issue #32 may read
 * hierarchy evidence, but it must never cascade, reparent, or edit membership.
 */
export interface AdminCategoryManagementCapability {
  /** GET /api/loai-cong-viec */
  listAllCategories(sessionToken: string, signal?: AbortSignal): Promise<readonly AdminServiceCategory[]>;
  /** GET /api/loai-cong-viec/phan-trang-tim-kiem */
  listCategories(
    params: AdminCategoryListParams,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminCategoryListResult>;
  /** GET /api/loai-cong-viec/{id} */
  getCategoryById(id: string, sessionToken: string, signal?: AbortSignal): Promise<AdminServiceCategory>;
  /** GET /api/cong-viec/lay-chi-tiet-loai-cong-viec/{id}; read-only dependency evidence. */
  getCategoryHierarchy(
    id: string,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminCategoryHierarchy>;
  /** POST /api/loai-cong-viec */
  createCategory(
    input: CategoryNameInput,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminServiceCategory>;
  /** PUT /api/loai-cong-viec/{id} */
  updateCategory(
    id: string,
    input: CategoryNameInput,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminServiceCategory>;
  /** DELETE /api/loai-cong-viec/{id} */
  deleteCategory(id: string, sessionToken: string, signal?: AbortSignal): Promise<void>;
}
