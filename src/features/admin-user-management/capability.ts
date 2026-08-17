export type CanonicalAdminUserRole = "USER" | "ADMIN";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  birthday: string;
  avatar: string | null;
  gender: boolean;
  /** Raw stored role. Only exact USER/ADMIN are canonical. */
  role: string;
  skills: string[];
  certifications: string[];
}

export interface AdminUserListParams {
  pageIndex: number;
  pageSize: number;
  keyword?: string;
}

export interface AdminUserListResult {
  pageIndex: number;
  pageSize: number;
  totalRow: number;
  keywords: string | null;
  /** Whether pagination/filtering came from the API or a safe full-resource fallback. */
  scope: "server" | "client-fallback";
  data: readonly AdminUser[];
}

export interface CreateAdministratorInput {
  name: string;
  email: string;
  password: string;
  phone: string;
  birthday: string;
  gender: boolean;
  skills: string[];
  certifications: string[];
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  phone?: string;
  birthday?: string;
  gender?: boolean;
  role?: CanonicalAdminUserRole;
  skills?: string[];
  certifications?: string[];
}

export type AdminUserManagementFailureKind =
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

export class AdminUserManagementFailure extends Error {
  readonly kind: AdminUserManagementFailureKind;

  constructor(kind: AdminUserManagementFailureKind) {
    super("Admin User Management request failed.");
    this.name = "AdminUserManagementFailure";
    this.kind = kind;
  }
}

/**
 * Public Administrator seam over the Cybersoft User resource.
 *
 * It intentionally excludes cross-User avatar upload because Issue #30 explicitly
 * excludes that workflow. The signed-in User avatar endpoint remains owned by Profile.
 */
export interface AdminUserManagementCapability {
  /** GET /api/users */
  listAllUsers(
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<readonly AdminUser[]>;
  /** GET /api/users/phan-trang-tim-kiem */
  listUsers(
    params: AdminUserListParams,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminUserListResult>;
  /** GET /api/users/search/{TenNguoiDung} */
  searchUsersByName(
    name: string,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<readonly AdminUser[]>;
  /** GET /api/users/{id} */
  getUserById(
    id: string,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminUser>;
  /** POST /api/users; Administrator-only creation seam. */
  createAdministrator(
    input: CreateAdministratorInput,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminUser>;
  /** PUT /api/users/{id} */
  updateUser(
    id: string,
    input: UpdateUserInput,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminUser>;
  /** DELETE /api/users?id=... */
  deleteUser(
    id: string,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<void>;
}
