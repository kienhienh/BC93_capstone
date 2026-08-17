export interface AdminComment {
  id: string;
  serviceId: string;
  authorId: string;
  content: string;
  rating: number | null;
  createdAt: string | null;
}

/**
 * Fresh single-Comment evidence from the per-Service comment read, which
 * does not echo Service or author ids — those are immutable per-Comment and
 * already known from the record that was originally loaded.
 */
export type AdminCommentEvidence = Pick<AdminComment, "id" | "content" | "rating">;

export interface AdminCommentServiceRef {
  id: string;
  title: string;
}

export interface AdminCommentAuthorRef {
  id: string;
  name: string;
}

export interface AdminCommentListParams {
  pageIndex: number;
  pageSize: number;
  keyword?: string;
}

export interface AdminCommentListResult {
  pageIndex: number;
  pageSize: number;
  totalRow: number;
  keywords: string | null;
  /** Always "client-fallback": the live paging/search endpoint for Comments does not work. */
  scope: "client-fallback";
  data: readonly AdminComment[];
}

export interface CreateCommentInput {
  serviceId: string;
  authorId: string;
  content: string;
  rating: number;
  createdAt: string;
}

/**
 * The edit form only ever changes content/rating. serviceId, authorId and
 * createdAt are required (not optional) so the caller must always thread the
 * verified baseline's values through explicitly — they can never silently
 * drift, default, or be user-selected.
 */
export interface UpdateCommentInput {
  serviceId: string;
  authorId: string;
  createdAt: string | null;
  content: string;
  rating: number;
}

export type AdminCommentManagementFailureKind =
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

export class AdminCommentManagementFailure extends Error {
  readonly kind: AdminCommentManagementFailureKind;

  constructor(kind: AdminCommentManagementFailureKind) {
    super("Admin Comment Management request failed.");
    this.name = "AdminCommentManagementFailure";
    this.kind = kind;
  }
}

/**
 * Administrator seam over the Comment resource (`binh-luan`). The live
 * contract has no `GET /binh-luan/{id}` and its declared paging/search
 * endpoint (`phan-trang-tim-kiem`) 404s, so this capability never attempts
 * server-side search: `listAllComments` is the only list read, and
 * `refetchCommentEvidence` reuses the verified per-Service comment read
 * (`lay-binh-luan-theo-cong-viec`) as a cheap, fresh single-Comment check
 * instead of refetching the complete snapshot.
 */
export interface AdminCommentManagementCapability {
  /** GET /api/binh-luan */
  listAllComments(sessionToken: string, signal?: AbortSignal): Promise<readonly AdminComment[]>;
  /** GET /api/binh-luan/lay-binh-luan-theo-cong-viec/{serviceId}; fresh evidence for one Comment. */
  refetchCommentEvidence(
    serviceId: string,
    commentId: string,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminCommentEvidence | null>;
  /** GET /api/cong-viec; Service id -> title lookup. */
  listAllServices(sessionToken: string, signal?: AbortSignal): Promise<readonly AdminCommentServiceRef[]>;
  /** GET /api/users; author id -> name lookup. Discards every other User field. */
  listAllAuthors(sessionToken: string, signal?: AbortSignal): Promise<readonly AdminCommentAuthorRef[]>;
  /** POST /api/binh-luan */
  createComment(input: CreateCommentInput, sessionToken: string, signal?: AbortSignal): Promise<AdminComment>;
  /** PUT /api/binh-luan/{id} */
  updateComment(
    id: string,
    input: UpdateCommentInput,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<AdminComment>;
  /** DELETE /api/binh-luan/{id} */
  deleteComment(id: string, sessionToken: string, signal?: AbortSignal): Promise<void>;
}
