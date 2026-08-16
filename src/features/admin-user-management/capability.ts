export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  birthday: string;
  avatar: string | null;
  gender: boolean;
  role: "USER" | "ADMIN";
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
  data: readonly AdminUser[];
}

export interface CreateUserInput {
  name: string;
  email: string;
  phone: string;
  birthday: string;
  gender: boolean;
  role: "USER" | "ADMIN";
  skills: string[];
  certifications: string[];
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
  | "unknown";

export class AdminUserManagementFailure extends Error {
  readonly kind: AdminUserManagementFailureKind;

  constructor(kind: AdminUserManagementFailureKind) {
    super("Admin User Management request failed.");
    this.name = "AdminUserManagementFailure";
    this.kind = kind;
  }
}

export interface AdminUserManagementCapability {
  listUsers(
    params: AdminUserListParams,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminUserListResult>;
  getUserById(
    id: string,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminUser>;
  createUser(
    input: CreateUserInput,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminUser>;
  updateUser(
    id: string,
    input: Partial<CreateUserInput>,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminUser>;
  deleteUser(
    id: string,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<void>;
}
