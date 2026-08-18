export interface HireService {
  id: string;
  title: string;
  price: number;
  seller: { id: string; name: string } | null;
}

export interface HiredService {
  id: string;
  serviceId: string;
  userId: string;
  hiredAt: string;
  completed: boolean;
  service: { title: string; price: number } | null;
  seller: { id: string; name: string } | null;
}

export interface CreateHireInput {
  serviceId: string;
  userId: string;
  sessionToken: string;
  hiredAt: string;
}

export type CreateHireResult =
  | { kind: "accepted"; hireId: string }
  | { kind: "unknown" };

export type CompleteHireResult =
  | { kind: "accepted" }
  | { kind: "unknown" };

export type CancelHireResult =
  | { kind: "accepted" }
  | { kind: "unknown" };

export interface PendingHireEvidence {
  serviceId: string;
  userId: string;
  hiredAt: string;
}

export type HireFailureKind =
  | "cancelled"
  | "malformed"
  | "not_found"
  | "missing_data"
  | "self_hire"
  | "stale"
  | "unauthorized"
  | "forbidden"
  | "offline"
  | "network"
  | "server"
  | "unknown"
  | "accepted_pending"
  | "unknown_reconciled"
  | "reconciliation_failed";

export class HireFailure extends Error {
  readonly kind: HireFailureKind;
  readonly latestService?: HireService;
  readonly hireId?: string;
  readonly pending?: PendingHireEvidence;

  constructor(kind: HireFailureKind, latestService?: HireService, hireId?: string, pending?: PendingHireEvidence) {
    super("Hire request failed.");
    this.name = "HireFailure";
    this.kind = kind;
    this.latestService = latestService;
    this.hireId = hireId;
    this.pending = pending;
  }
}

/**
 * `listHiredServices`/`getHiredService` take the caller's own `userId`
 * because the live read they wrap (`lay-danh-sach-da-thue`) is already
 * scoped to the authenticated session and never echoes the owning User's
 * id back — it is stamped onto each mapped record from the known caller
 * identity, not fabricated.
 */
export interface HireConfirmationCapability {
  getService(serviceId: string, signal: AbortSignal): Promise<HireService>;
  createHire(input: CreateHireInput, signal?: AbortSignal): Promise<CreateHireResult>;
  listHiredServices(sessionToken: string, userId: string, signal?: AbortSignal): Promise<HiredService[]>;
  getHiredService(hireId: string, sessionToken: string, userId: string, signal?: AbortSignal): Promise<HiredService>;
  completeHire(hireId: string, sessionToken: string, signal?: AbortSignal): Promise<CompleteHireResult>;
  cancelHire(hireId: string, sessionToken: string, signal?: AbortSignal): Promise<CancelHireResult>;
}
