import { z } from "zod";
import {
  AdminHiredServiceManagementFailure,
  type AdminHiredService,
  type AdminHiredServiceEvidence,
  type AdminHiredServiceManagementCapability,
  type AdminHiredServiceServiceRef,
  type AdminHiredServiceUserRef,
} from "../../features/admin-hired-service-management/capability";

const idSchema = z.union([z.number().int().nonnegative(), z.string().min(1)]);
const optionalText = z.preprocess(
  (value) => typeof value === "string" && value.trim().length === 0 ? null : value,
  z.string().nullable().optional(),
);

const hiredServiceSchema = z.object({
  id: idSchema,
  maCongViec: idSchema,
  maNguoiThue: idSchema,
  ngayThue: z.string().default(""),
  hoanThanh: z.boolean().default(false),
});
const hiredServiceListEnvelopeSchema = z.object({ content: z.array(hiredServiceSchema) });

const serviceRefSchema = z.object({
  id: idSchema,
  tenCongViec: z.string().trim().min(1),
  giaTien: z.number().finite().nonnegative(),
  nguoiTao: idSchema.nullable().optional(),
});
const serviceListEnvelopeSchema = z.object({ content: z.array(serviceRefSchema) });

const userRefSchema = z.object({ id: idSchema, name: optionalText });
const userListEnvelopeSchema = z.object({ content: z.array(userRefSchema) });

function mapHiredService(value: z.infer<typeof hiredServiceSchema>): AdminHiredService {
  return {
    id: String(value.id),
    serviceId: String(value.maCongViec),
    clientId: String(value.maNguoiThue),
    hiredAt: value.ngayThue,
    completed: value.hoanThanh,
  };
}

function mapServiceRef(value: z.infer<typeof serviceRefSchema>): AdminHiredServiceServiceRef {
  return {
    id: String(value.id),
    title: value.tenCongViec,
    price: value.giaTien,
    sellerId: value.nguoiTao === null || value.nguoiTao === undefined ? null : String(value.nguoiTao),
  };
}

function mapUserRef(value: z.infer<typeof userRefSchema>): AdminHiredServiceUserRef {
  return { id: String(value.id), name: value.name?.trim() || `User #${value.id}` };
}

function failure(status: number) {
  if (status === 400 || status === 409 || status === 422) return new AdminHiredServiceManagementFailure("validation");
  if (status === 401) return new AdminHiredServiceManagementFailure("unauthorized");
  if (status === 403) return new AdminHiredServiceManagementFailure("forbidden");
  if (status === 404) return new AdminHiredServiceManagementFailure("not_found");
  return new AdminHiredServiceManagementFailure(status >= 500 ? "server" : "unknown");
}

async function responseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function transport(error: unknown, signal?: AbortSignal) {
  if (error instanceof AdminHiredServiceManagementFailure) return error;
  if (signal?.aborted) return new AdminHiredServiceManagementFailure("cancelled");
  if (typeof navigator !== "undefined" && !navigator.onLine) return new AdminHiredServiceManagementFailure("offline");
  if (error instanceof TypeError) return new AdminHiredServiceManagementFailure("network");
  if (error instanceof SyntaxError) return new AdminHiredServiceManagementFailure("malformed");
  return new AdminHiredServiceManagementFailure("unknown");
}

function mutationTransport(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted) return new AdminHiredServiceManagementFailure("cancelled");
  if (typeof navigator !== "undefined" && !navigator.onLine) return new AdminHiredServiceManagementFailure("offline");
  if (error instanceof AdminHiredServiceManagementFailure) {
    if (["malformed", "network", "unknown"].includes(error.kind)) return new AdminHiredServiceManagementFailure("unknown_outcome");
    return error;
  }
  if (error instanceof TypeError || error instanceof SyntaxError) return new AdminHiredServiceManagementFailure("unknown_outcome");
  return new AdminHiredServiceManagementFailure("unknown_outcome");
}

export function createCybersoftAdminHiredServiceManagementCapability(config: {
  apiBaseUrl: string;
  cybersoftToken: string;
}): AdminHiredServiceManagementCapability {
  const baseHeaders = { tokenCybersoft: config.cybersoftToken };
  const authHeaders = (sessionToken: string) => ({ ...baseHeaders, token: sessionToken });

  async function fetchAllHiredServices(sessionToken: string, signal?: AbortSignal) {
    const response = await fetch(`${config.apiBaseUrl}/thue-cong-viec`, { signal, headers: authHeaders(sessionToken) });
    if (!response.ok) throw failure(response.status);
    const parsed = hiredServiceListEnvelopeSchema.safeParse(await responseJson(response));
    if (!parsed.success) throw new AdminHiredServiceManagementFailure("malformed");
    return parsed.data.content.map(mapHiredService);
  }

  return {
    async listAllHiredServices(sessionToken, signal) {
      try {
        return await fetchAllHiredServices(sessionToken, signal);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async refetchHiredServiceEvidence(id, sessionToken, signal): Promise<AdminHiredServiceEvidence | null> {
      try {
        const all = await fetchAllHiredServices(sessionToken, signal);
        const match = all.find((hiredService) => hiredService.id === id);
        return match ? { id: match.id, completed: match.completed } : null;
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async listAllServices(sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/cong-viec`, { signal, headers: authHeaders(sessionToken) });
        if (!response.ok) throw failure(response.status);
        const parsed = serviceListEnvelopeSchema.safeParse(await responseJson(response));
        if (!parsed.success) throw new AdminHiredServiceManagementFailure("malformed");
        return parsed.data.content.map(mapServiceRef);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async listAllUsers(sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/users`, { signal, headers: authHeaders(sessionToken) });
        if (!response.ok) throw failure(response.status);
        const parsed = userListEnvelopeSchema.safeParse(await responseJson(response));
        if (!parsed.success) throw new AdminHiredServiceManagementFailure("malformed");
        return parsed.data.content.map(mapUserRef);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async completeHiredService(id, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/thue-cong-viec/${encodeURIComponent(id)}`, {
          method: "PUT",
          signal,
          headers: { "Content-Type": "application/json", ...authHeaders(sessionToken) },
          body: JSON.stringify({ hoanThanh: true }),
        });
        if (!response.ok) throw failure(response.status);
      } catch (error) {
        throw mutationTransport(error, signal);
      }
    },

    async cancelHiredService(id, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/thue-cong-viec/${encodeURIComponent(id)}`, {
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
