export interface AdminSubcategory {
  id: string;
  name: string;
  /** Relationship context is present when the API proves it from a Group snapshot. */
  groupId?: string;
  groupName?: string;
  categoryId?: string;
}

export interface AdminSubcategoryListParams {
  pageIndex: number;
  pageSize: number;
  keyword?: string;
}

export interface AdminSubcategoryListResult {
  pageIndex: number;
  pageSize: number;
  totalRow: number;
  keywords: string | null;
  scope: "server" | "client-fallback";
  data: readonly AdminSubcategory[];
}

export interface SubcategoryNameInput {
  name: string;
}

export interface AdminTaxonomyCategory {
  id: string;
  name: string;
}

export interface AdminGroupMember {
  id: string;
  name: string;
}

export interface AdminServiceGroup {
  id: string;
  name: string;
  imageUrl: string | null;
  subcategories: readonly AdminGroupMember[];
}

export interface AdminCategoryHierarchy {
  categoryId: string;
  categoryName: string;
  groups: readonly AdminServiceGroup[];
}

export interface GroupMembershipInput {
  name: string;
  categoryId: string;
  subcategoryIds: readonly string[];
}

export type AdminSubcategoryManagementFailureKind =
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

export class AdminSubcategoryManagementFailure extends Error {
  readonly kind: AdminSubcategoryManagementFailureKind;

  constructor(kind: AdminSubcategoryManagementFailureKind) {
    super("Admin Service Subcategory Management request failed.");
    this.name = "AdminSubcategoryManagementFailure";
    this.kind = kind;
  }
}

/**
 * Administrator seam over Service Subcategory identity (`chi-tiet-loai-cong-viec`)
 * and Service Group create/edit (`them-nhom-chi-tiet-loai`, `sua-nhom-chi-tiet-loai`).
 * The live contract publishes no Group list/detail read and no Group delete, so
 * `getCategoryHierarchy` (the same read Issue #32 uses) is the only source of
 * truth for Group identity and current membership; Group mutation responses are
 * treated as success/failure signals only, never as rendered state.
 */
export interface AdminSubcategoryManagementCapability {
  /** GET /api/loai-cong-viec; Category picker for Group create/edit. */
  listAllCategories(sessionToken: string, signal?: AbortSignal): Promise<readonly AdminTaxonomyCategory[]>;
  /** GET /api/cong-viec/lay-chi-tiet-loai-cong-viec/{id}; canonical Group/Subcategory evidence. */
  getCategoryHierarchy(
    categoryId: string,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminCategoryHierarchy>;
  /** GET /api/chi-tiet-loai-cong-viec; complete Subcategory snapshot for pickers and duplicate checks. */
  listAllSubcategories(sessionToken: string, signal?: AbortSignal): Promise<readonly AdminSubcategory[]>;
  /** GET /api/chi-tiet-loai-cong-viec/phan-trang-tim-kiem */
  listSubcategories(
    params: AdminSubcategoryListParams,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminSubcategoryListResult>;
  /** Resolve one selectable leaf from the authoritative Group/Subcategory snapshot. */
  getSubcategoryById(id: string, sessionToken: string, signal?: AbortSignal): Promise<AdminSubcategory>;
  /** POST /api/chi-tiet-loai-cong-viec */
  createSubcategory(
    input: SubcategoryNameInput,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminSubcategory>;
  /** PUT /api/chi-tiet-loai-cong-viec/{id} */
  updateSubcategory(
    id: string,
    input: SubcategoryNameInput,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminSubcategory>;
  /** DELETE /api/chi-tiet-loai-cong-viec/{id} */
  deleteSubcategory(id: string, sessionToken: string, signal?: AbortSignal): Promise<void>;
  /** POST /api/chi-tiet-loai-cong-viec/them-nhom-chi-tiet-loai */
  createGroup(input: GroupMembershipInput, sessionToken: string, signal?: AbortSignal): Promise<void>;
  /** PUT /api/chi-tiet-loai-cong-viec/sua-nhom-chi-tiet-loai/{id} */
  updateGroup(
    groupId: string,
    input: GroupMembershipInput,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<void>;
}
