export interface AdminService {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  price: number;
  imageUrl: string | null;
  /** Star rating, 0-5. Administrator-editable. */
  rating: number;
  /** Server-owned review count. Never user-editable; create sets 0, edit preserves it. */
  reviewCount: number;
  sellerId: string;
  sellerName: string | null;
  subcategoryId: string;
  categoryName: string | null;
  groupName: string | null;
  subcategoryName: string | null;
}

export interface AdminServiceListParams {
  pageIndex: number;
  pageSize: number;
  keyword?: string;
}

export interface AdminServiceListResult {
  pageIndex: number;
  pageSize: number;
  totalRow: number;
  keywords: string | null;
  /** Whether pagination/filtering came from the API or a safe full-resource fallback. */
  scope: "server" | "client-fallback";
  data: readonly AdminService[];
}

export interface CreateServiceInput {
  title: string;
  description: string;
  shortDescription: string;
  price: number;
  sellerId: string;
  subcategoryId: string;
  rating: number;
}

/**
 * The edit form always submits a complete record (mirroring CreateServiceInput),
 * plus reviewCount, which is required (not optional) so the caller must always
 * thread the baseline's server-owned value through explicitly — it can never
 * silently default, drift, or be recalculated by the client.
 */
export type UpdateServiceInput = CreateServiceInput & { reviewCount: number };

export type AdminServiceManagementFailureKind =
  | "cancelled"
  | "malformed"
  | "offline"
  | "network"
  | "server"
  | "not_found"
  | "forbidden"
  | "unauthorized"
  | "unknown_outcome"
  | "unknown";

export class AdminServiceManagementFailure extends Error {
  readonly kind: AdminServiceManagementFailureKind;

  constructor(kind: AdminServiceManagementFailureKind) {
    super("Admin Service Management request failed.");
    this.name = "AdminServiceManagementFailure";
    this.kind = kind;
  }
}

/**
 * Public Administrator seam over the Cybersoft Service ("cong-viec") resource.
 *
 * Seller is always selected from existing Users, never free-typed, so this
 * capability does not expose its own "list users" method — callers reuse
 * AdminUserManagementCapability for that. hasHiresForService exists purely to
 * prove absence before a destructive delete; it must never be treated as
 * false when the underlying check fails.
 */
export interface AdminServiceManagementCapability {
  /** GET /api/cong-viec */
  listAllServices(sessionToken: string, signal?: AbortSignal): Promise<readonly AdminService[]>;
  /** GET /api/cong-viec/phan-trang-tim-kiem */
  listServices(
    params: AdminServiceListParams,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminServiceListResult>;
  /** GET /api/cong-viec/lay-danh-sach-cong-viec-theo-ten/{TenCongViec} */
  searchServicesByName(
    name: string,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<readonly AdminService[]>;
  /** GET /api/cong-viec/{id} */
  getServiceById(id: string, sessionToken: string, signal?: AbortSignal): Promise<AdminService>;
  /** POST /api/cong-viec */
  createService(
    input: CreateServiceInput,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminService>;
  /** PUT /api/cong-viec/{id} */
  updateService(
    id: string,
    input: UpdateServiceInput,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminService>;
  /** DELETE /api/cong-viec/{id} */
  deleteService(id: string, sessionToken: string, signal?: AbortSignal): Promise<void>;
  /** POST /api/cong-viec/upload-hinh-cong-viec/{id} */
  uploadServiceImage(
    id: string,
    file: File,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminService>;
  /** GET /api/thue-cong-viec, filtered client-side by service id */
  hasHiresForService(
    serviceId: string,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<boolean>;
}
