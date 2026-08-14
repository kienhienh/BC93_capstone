export interface SubmitCommentInput {
  serviceId: string;
  userId: string;
  sessionToken: string;
  rating: number;
  content: string;
  createdAt: string;
}

export interface AcceptedComment {
  kind: "accepted";
  commentId: string;
}

export interface UnknownCommentOutcome {
  kind: "unknown";
}

export type CommentSubmissionResult = AcceptedComment | UnknownCommentOutcome;

export type CommentSubmissionFailureKind =
  | "cancelled"
  | "offline"
  | "server"
  | "unauthorized"
  | "forbidden"
  | "unknown";

export class CommentSubmissionFailure extends Error {
  readonly kind: CommentSubmissionFailureKind;

  constructor(kind: CommentSubmissionFailureKind) {
    super("Comment submission failed.");
    this.name = "CommentSubmissionFailure";
    this.kind = kind;
  }
}

export interface CommentSubmissionCapability {
  submitComment(input: SubmitCommentInput, signal?: AbortSignal): Promise<CommentSubmissionResult>;
}
