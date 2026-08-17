import { z } from "zod";
import {
  AdminCommentManagementFailure,
  type AdminComment,
  type AdminCommentAuthorRef,
  type AdminCommentEvidence,
  type AdminCommentManagementCapability,
  type AdminCommentServiceRef,
  type CreateCommentInput,
  type UpdateCommentInput,
} from "../../features/admin-comment-management/capability";

const idSchema = z.union([z.number().int().nonnegative(), z.string().min(1)]);
const optionalText = z.preprocess(
  (value) => typeof value === "string" && value.trim().length === 0 ? null : value,
  z.string().nullable().optional(),
);
const optionalRating = z.preprocess(
  (value) => typeof value === "number" && (!Number.isFinite(value) || value < 0 || value > 5) ? null : value,
  z.number().finite().min(0).max(5).nullable().optional(),
);

const commentSchema = z.object({
  id: idSchema,
  maCongViec: idSchema,
  maNguoiBinhLuan: idSchema,
  ngayBinhLuan: optionalText,
  noiDung: z.string().default(""),
  saoBinhLuan: optionalRating,
});
const commentEnvelopeSchema = z.object({ content: z.union([commentSchema, z.array(commentSchema)]) });
const commentListEnvelopeSchema = z.object({ content: z.array(commentSchema) });

const serviceRefSchema = z.object({ id: idSchema, tenCongViec: z.string().trim().min(1) });
const serviceListEnvelopeSchema = z.object({ content: z.array(serviceRefSchema) });

const authorRefSchema = z.object({ id: idSchema, name: optionalText });
const authorListEnvelopeSchema = z.object({ content: z.array(authorRefSchema) });

const serviceCommentSchema = z.object({
  id: idSchema,
  ngayBinhLuan: optionalText,
  noiDung: z.string().default(""),
  saoBinhLuan: optionalRating,
});
const serviceCommentsEnvelopeSchema = z.object({ content: z.array(serviceCommentSchema) });

function mapComment(value: z.infer<typeof commentSchema>): AdminComment {
  return {
    id: String(value.id),
    serviceId: String(value.maCongViec),
    authorId: String(value.maNguoiBinhLuan),
    content: value.noiDung,
    rating: value.saoBinhLuan ?? null,
    createdAt: value.ngayBinhLuan ?? null,
  };
}

function mapServiceRef(value: z.infer<typeof serviceRefSchema>): AdminCommentServiceRef {
  return { id: String(value.id), title: value.tenCongViec };
}

function mapAuthorRef(value: z.infer<typeof authorRefSchema>): AdminCommentAuthorRef {
  return { id: String(value.id), name: value.name?.trim() || `User #${value.id}` };
}

function numericId(value: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new AdminCommentManagementFailure("validation");
  return parsed;
}

function failure(status: number) {
  if (status === 400 || status === 409 || status === 422) return new AdminCommentManagementFailure("validation");
  if (status === 401) return new AdminCommentManagementFailure("unauthorized");
  if (status === 403) return new AdminCommentManagementFailure("forbidden");
  if (status === 404) return new AdminCommentManagementFailure("not_found");
  return new AdminCommentManagementFailure(status >= 500 ? "server" : "unknown");
}

async function responseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function transport(error: unknown, signal?: AbortSignal) {
  if (error instanceof AdminCommentManagementFailure) return error;
  if (signal?.aborted) return new AdminCommentManagementFailure("cancelled");
  if (typeof navigator !== "undefined" && !navigator.onLine) return new AdminCommentManagementFailure("offline");
  if (error instanceof TypeError) return new AdminCommentManagementFailure("network");
  if (error instanceof SyntaxError) return new AdminCommentManagementFailure("malformed");
  return new AdminCommentManagementFailure("unknown");
}

function mutationTransport(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted) return new AdminCommentManagementFailure("cancelled");
  if (typeof navigator !== "undefined" && !navigator.onLine) return new AdminCommentManagementFailure("offline");
  if (error instanceof AdminCommentManagementFailure) {
    if (["malformed", "network", "unknown"].includes(error.kind)) return new AdminCommentManagementFailure("unknown_outcome");
    return error;
  }
  if (error instanceof TypeError || error instanceof SyntaxError) return new AdminCommentManagementFailure("unknown_outcome");
  return new AdminCommentManagementFailure("unknown_outcome");
}

export function createCybersoftAdminCommentManagementCapability(config: {
  apiBaseUrl: string;
  cybersoftToken: string;
}): AdminCommentManagementCapability {
  const baseHeaders = { tokenCybersoft: config.cybersoftToken };
  const authHeaders = (sessionToken: string) => ({ ...baseHeaders, token: sessionToken });

  return {
    async listAllComments(sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/binh-luan`, { signal, headers: authHeaders(sessionToken) });
        if (!response.ok) throw failure(response.status);
        const parsed = commentListEnvelopeSchema.safeParse(await responseJson(response));
        if (!parsed.success) throw new AdminCommentManagementFailure("malformed");
        return parsed.data.content.map(mapComment);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async refetchCommentEvidence(serviceId, commentId, sessionToken, signal): Promise<AdminCommentEvidence | null> {
      try {
        const response = await fetch(
          `${config.apiBaseUrl}/binh-luan/lay-binh-luan-theo-cong-viec/${encodeURIComponent(serviceId)}`,
          { signal, headers: authHeaders(sessionToken) },
        );
        if (!response.ok) throw failure(response.status);
        const parsed = serviceCommentsEnvelopeSchema.safeParse(await responseJson(response));
        if (!parsed.success) throw new AdminCommentManagementFailure("malformed");
        const match = parsed.data.content.find((comment) => String(comment.id) === commentId);
        if (!match) return null;
        return { id: String(match.id), content: match.noiDung, rating: match.saoBinhLuan ?? null };
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async listAllServices(sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/cong-viec`, { signal, headers: authHeaders(sessionToken) });
        if (!response.ok) throw failure(response.status);
        const parsed = serviceListEnvelopeSchema.safeParse(await responseJson(response));
        if (!parsed.success) throw new AdminCommentManagementFailure("malformed");
        return parsed.data.content.map(mapServiceRef);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async listAllAuthors(sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/users`, { signal, headers: authHeaders(sessionToken) });
        if (!response.ok) throw failure(response.status);
        const parsed = authorListEnvelopeSchema.safeParse(await responseJson(response));
        if (!parsed.success) throw new AdminCommentManagementFailure("malformed");
        return parsed.data.content.map(mapAuthorRef);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async createComment(input: CreateCommentInput, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/binh-luan`, {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json", ...authHeaders(sessionToken) },
          body: JSON.stringify({
            maCongViec: numericId(input.serviceId),
            maNguoiBinhLuan: numericId(input.authorId),
            ngayBinhLuan: input.createdAt,
            noiDung: input.content,
            saoBinhLuan: input.rating,
          }),
        });
        if (!response.ok) throw failure(response.status);
        const parsed = commentEnvelopeSchema.safeParse(await responseJson(response));
        if (!parsed.success) throw new AdminCommentManagementFailure("malformed");
        const content = parsed.data.content;
        const item = Array.isArray(content) ? content[0] : content;
        if (!item) throw new AdminCommentManagementFailure("malformed");
        return mapComment(item);
      } catch (error) {
        throw mutationTransport(error, signal);
      }
    },

    async updateComment(id, input: UpdateCommentInput, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/binh-luan/${encodeURIComponent(id)}`, {
          method: "PUT",
          signal,
          headers: { "Content-Type": "application/json", ...authHeaders(sessionToken) },
          body: JSON.stringify({
            id: numericId(id),
            maCongViec: numericId(input.serviceId),
            maNguoiBinhLuan: numericId(input.authorId),
            ngayBinhLuan: input.createdAt,
            noiDung: input.content,
            saoBinhLuan: input.rating,
          }),
        });
        if (!response.ok) throw failure(response.status);
        return {
          id,
          serviceId: input.serviceId,
          authorId: input.authorId,
          content: input.content,
          rating: input.rating,
          createdAt: input.createdAt,
        };
      } catch (error) {
        throw mutationTransport(error, signal);
      }
    },

    async deleteComment(id, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/binh-luan/${encodeURIComponent(id)}`, {
          method: "DELETE",
          signal,
          headers: authHeaders(sessionToken),
        });
        if (!response.ok) throw failure(response.status);
      } catch (error) {
        throw mutationTransport(error, signal);
      }
    },
  };
}
