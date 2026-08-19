export interface AdminHiredService {
  id: string;
  serviceId: string;
  clientId: string;
  hiredAt: string;
  completed: boolean;
}

/**
 * Fresh single-Hired-Service evidence. serviceId, clientId and hiredAt are
 * immutable per engagement; only `completed` can change, and the record can
 * disappear entirely once cancelled (deleted).
 */
export type AdminHiredServiceEvidence = Pick<AdminHiredService, "id" | "completed">;

export interface AdminHiredServiceServiceRef {
  id: string;
  title: string;
  /** Current Service price. Not the amount paid at hire time — that history is not retained. */
  price: number;
  sellerId: string | null;
}

export interface AdminHiredServiceUserRef {
  id: string;
  name: string;
}

export interface AdminHiredServiceListParams {
  pageIndex: number;
  pageSize: number;
  keyword?: string;
  status?: "all" | "active" | "completed";
}

export interface AdminHiredServiceListResult {
  pageIndex: number;
  pageSize: number;
  totalRow: number;
  keywords: string | null;
  /** Always "client-fallback": the live search/paging endpoint's keyword filter is broken server-side. */
  scope: "client-fallback";
  data: readonly AdminHiredService[];
}

export type AdminHiredServiceManagementFailureKind =
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

export class AdminHiredServiceManagementFailure extends Error {
  readonly kind: AdminHiredServiceManagementFailureKind;

  constructor(kind: AdminHiredServiceManagementFailureKind) {
    super("Admin Hired Service Management request failed.");
    this.name = "AdminHiredServiceManagementFailure";
    this.kind = kind;
  }
}

/**
 * Administrator seam over the Hired Service resource (`thue-cong-viec`). The
 * live contract has no `GET /thue-cong-viec/{id}`, and the declared
 * search/paging endpoint's `keyword` filter 500s (it references a column
 * that does not exist on the underlying join), so this capability never
 * sends a server-side keyword: `listAllHiredServices` is the only list read,
 * and `refetchHiredServiceEvidence` re-reads that same complete snapshot to
 * find fresh evidence for one record.
 *
 * There is no Administrator-side create: Hires are only ever created by the
 * Client themselves (issue #27). Complete/Cancel reuse the same PUT/DELETE
 * verbs already proven by the Client-facing capability.
 */
export interface AdminHiredServiceManagementCapability {
  /** GET /api/thue-cong-viec */
  listAllHiredServices(sessionToken: string, signal?: AbortSignal): Promise<readonly AdminHiredService[]>;
  /** GET /api/thue-cong-viec; fresh evidence for one Hired Service, or null if it no longer exists. */
  refetchHiredServiceEvidence(
    id: string,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminHiredServiceEvidence | null>;
  /** GET /api/cong-viec; Service id -> title/price/sellerId lookup. */
  listAllServices(sessionToken: string, signal?: AbortSignal): Promise<readonly AdminHiredServiceServiceRef[]>;
  /** GET /api/users; user id -> name lookup, used for both Client and Seller. Discards every other User field. */
  listAllUsers(sessionToken: string, signal?: AbortSignal): Promise<readonly AdminHiredServiceUserRef[]>;
  /** PUT /api/thue-cong-viec/{id} { hoanThanh: true } */
  completeHiredService(id: string, sessionToken: string, signal?: AbortSignal): Promise<void>;
  /** DELETE /api/thue-cong-viec/{id} */
  cancelHiredService(id: string, sessionToken: string, signal?: AbortSignal): Promise<void>;
}
