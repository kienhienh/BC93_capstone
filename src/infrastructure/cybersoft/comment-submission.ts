import { z } from "zod";
import type {
  CommentSubmissionCapability,
  SubmitCommentInput,
} from "../../features/comment-submission/capability";
import { CommentSubmissionFailure } from "../../features/comment-submission/capability";

const acceptedEnvelopeSchema = z.object({
  content: z.object({
    id: z.union([z.number().int().nonnegative(), z.string().trim().min(1)]),
  }),
});

function numericId(value: string, field: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${field} is invalid.`);
  }
  return parsed;
}

function requestBody(input: SubmitCommentInput) {
  return {
    maCongViec: numericId(input.serviceId, "Service ID"),
    maNguoiBinhLuan: numericId(input.userId, "User ID"),
    ngayBinhLuan: input.createdAt,
    noiDung: input.content,
    saoBinhLuan: input.rating,
  };
}

export function createCybersoftCommentSubmissionCapability(config: {
  apiBaseUrl: string;
  cybersoftToken: string;
}): CommentSubmissionCapability {
  return {
    async submitComment(input, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/binh-luan`, {
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
            token: input.sessionToken,
            tokenCybersoft: config.cybersoftToken,
          },
          body: JSON.stringify(requestBody(input)),
        });
        if (!response.ok) {
          if (response.status === 401) throw new CommentSubmissionFailure("unauthorized");
          if (response.status === 403) throw new CommentSubmissionFailure("forbidden");
          throw new CommentSubmissionFailure(response.status >= 500 ? "server" : "unknown");
        }
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          return { kind: "unknown" };
        }
        const parsed = acceptedEnvelopeSchema.safeParse(payload);
        if (!parsed.success) {
          return { kind: "unknown" };
        }
        return { kind: "accepted", commentId: String(parsed.data.content.id) };
      } catch (error) {
        if (error instanceof CommentSubmissionFailure) throw error;
        if (signal?.aborted) throw new CommentSubmissionFailure("cancelled");
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          throw new CommentSubmissionFailure("offline");
        }
        if (error instanceof TypeError) return { kind: "unknown" };
        throw new CommentSubmissionFailure("unknown");
      }
    },
  };
}
