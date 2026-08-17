import { z } from "zod";
import {
  AdminUserManagementFailure,
  type AdminUser,
  type AdminUserListResult,
  type AdminUserManagementCapability,
  type CreateUserInput,
  type UpdateUserInput,
  type AdminUserListParams,
} from "../../features/admin-user-management/capability";

const id = z.union([z.string(), z.number()]);

const looseString = z
  .union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])
  .transform((value) => (value == null ? "" : String(value)));

const nullableString = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => (value == null || value === "" ? null : String(value)));

const booleanish = z
  .union([z.boolean(), z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "1") return true;
      if (normalized === "false" || normalized === "0") return false;
    }
    return true;
  });

const numberish = z
  .union([z.number(), z.string()])
  .transform((value, context) => {
    const result = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(result)) {
      context.addIssue({ code: "custom", message: "Expected a finite number" });
      return z.NEVER;
    }
    return result;
  });

const list = z
  .union([z.array(z.unknown()), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string | number => typeof item === "string" || typeof item === "number")
        .map(String);
    }
    if (!value || value === "null") return [];
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed
            .filter((item): item is string | number => typeof item === "string" || typeof item === "number")
            .map(String)
        : [value];
    } catch {
      return [value];
    }
  });

/**
 * Read-side parsing is intentionally tolerant of legacy records. The User API has
 * historical free-form role values and other dirty data, so one legacy record must
 * not make the whole Administrator list look malformed. Form/mutation validation
 * remains strict at the feature boundary.
 */
const userSchema = z.object({
  id,
  name: looseString,
  email: looseString,
  phone: looseString,
  birthday: looseString,
  avatar: nullableString,
  gender: booleanish,
  role: looseString,
  skill: list,
  certification: list,
}).passthrough();

const keyword = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => (value == null || value === "" ? null : String(value)));

const userListResponseSchema = z.object({
  content: z.object({
    pageIndex: numberish,
    pageSize: numberish,
    totalRow: numberish,
    keywords: keyword.optional(),
    data: z.array(userSchema),
  }).passthrough(),
}).passthrough();

const manyUsersResponseSchema = z.object({
  content: z.array(userSchema),
}).passthrough();

const singleUserResponseSchema = z.object({
  content: userSchema,
}).passthrough();

const oneOrManyUserResponseSchema = z.object({
  content: z.union([userSchema, z.array(userSchema)]),
}).passthrough();

function mapToAdminUser(value: z.infer<typeof userSchema>): AdminUser {
  return {
    id: String(value.id),
    name: value.name,
    email: value.email,
    phone: value.phone,
    birthday: value.birthday.slice(0, 10),
    avatar: value.avatar,
    gender: value.gender,
    role: value.role,
    skills: value.skill,
    certifications: value.certification,
  };
}

function numeric(value: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new AdminUserManagementFailure("malformed");
  return result;
}

function failure(status: number): AdminUserManagementFailure {
  if (status === 401) return new AdminUserManagementFailure("unauthorized");
  if (status === 403) return new AdminUserManagementFailure("forbidden");
  if (status === 404) return new AdminUserManagementFailure("not_found");
  return new AdminUserManagementFailure(status >= 500 ? "server" : "unknown");
}

async function responseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

async function parseListResponse(response: Response): Promise<AdminUserListResult> {
  if (!response.ok) throw failure(response.status);
  const parsed = userListResponseSchema.safeParse(await responseJson(response));
  if (!parsed.success) throw new AdminUserManagementFailure("malformed");
  return {
    pageIndex: parsed.data.content.pageIndex,
    pageSize: parsed.data.content.pageSize,
    totalRow: parsed.data.content.totalRow,
    keywords: parsed.data.content.keywords ?? null,
    scope: "server",
    data: parsed.data.content.data.map(mapToAdminUser),
  };
}

async function parseManyUsersResponse(response: Response): Promise<readonly AdminUser[]> {
  if (!response.ok) throw failure(response.status);
  const parsed = manyUsersResponseSchema.safeParse(await responseJson(response));
  if (!parsed.success) throw new AdminUserManagementFailure("malformed");
  return parsed.data.content.map(mapToAdminUser);
}

async function parseSingleUserResponse(response: Response): Promise<AdminUser> {
  if (!response.ok) throw failure(response.status);
  const parsed = singleUserResponseSchema.safeParse(await responseJson(response));
  if (!parsed.success) throw new AdminUserManagementFailure("malformed");
  return mapToAdminUser(parsed.data.content);
}

async function parseGetUserResponse(response: Response): Promise<AdminUser> {
  if (!response.ok) throw failure(response.status);
  const parsed = oneOrManyUserResponseSchema.safeParse(await responseJson(response));
  if (!parsed.success) throw new AdminUserManagementFailure("malformed");
  const first = Array.isArray(parsed.data.content)
    ? parsed.data.content[0]
    : parsed.data.content;
  if (!first) throw new AdminUserManagementFailure("not_found");
  return mapToAdminUser(first);
}

function transport(error: unknown, signal?: AbortSignal): AdminUserManagementFailure {
  if (error instanceof AdminUserManagementFailure) return error;
  if (signal?.aborted) return new AdminUserManagementFailure("cancelled");
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return new AdminUserManagementFailure("offline");
  }
  if (error instanceof TypeError) return new AdminUserManagementFailure("network");
  return new AdminUserManagementFailure("unknown");
}

function clientFallbackList(
  users: readonly AdminUser[],
  params: AdminUserListParams,
): AdminUserListResult {
  const query = params.keyword?.trim().toLowerCase() ?? "";
  const filtered = query
    ? users.filter((user) =>
        user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query))
    : [...users];
  const start = (params.pageIndex - 1) * params.pageSize;
  return {
    pageIndex: params.pageIndex,
    pageSize: params.pageSize,
    totalRow: filtered.length,
    keywords: params.keyword ?? null,
    scope: "client-fallback",
    data: filtered.slice(start, start + params.pageSize),
  };
}

function mutationTransport(error: unknown, signal?: AbortSignal): AdminUserManagementFailure {
  if (signal?.aborted) return new AdminUserManagementFailure("cancelled");
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return new AdminUserManagementFailure("offline");
  }
  if (error instanceof AdminUserManagementFailure) {
    if (error.kind === "malformed" || error.kind === "network" || error.kind === "unknown") {
      return new AdminUserManagementFailure("unknown_outcome");
    }
    return error;
  }
  if (error instanceof TypeError) return new AdminUserManagementFailure("unknown_outcome");
  return new AdminUserManagementFailure("unknown_outcome");
}

export function createCybersoftAdminUserManagementCapability(config: {
  apiBaseUrl: string;
  cybersoftToken: string;
}): AdminUserManagementCapability {
  const headers = { tokenCybersoft: config.cybersoftToken };

  return {
    async listAllUsers(sessionToken: string, signal?: AbortSignal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/users`, {
          signal,
          headers: { ...headers, token: sessionToken },
        });
        return await parseManyUsersResponse(response);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async listUsers(params: AdminUserListParams, sessionToken: string, signal?: AbortSignal) {
      try {
        const url = new URL(`${config.apiBaseUrl}/users/phan-trang-tim-kiem`);
        url.searchParams.set("pageIndex", String(params.pageIndex));
        url.searchParams.set("pageSize", String(params.pageSize));
        if (params.keyword) url.searchParams.set("keyword", params.keyword);
        const response = await fetch(url.toString(), {
          signal,
          headers: { ...headers, token: sessionToken },
        });
        try {
          return await parseListResponse(response);
        } catch (error) {
          if (!(error instanceof AdminUserManagementFailure) || error.kind !== "malformed") throw error;
          const fallbackResponse = await fetch(`${config.apiBaseUrl}/users`, {
            signal,
            headers: { ...headers, token: sessionToken },
          });
          return clientFallbackList(await parseManyUsersResponse(fallbackResponse), params);
        }
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async searchUsersByName(name: string, sessionToken: string, signal?: AbortSignal) {
      try {
        const response = await fetch(
          `${config.apiBaseUrl}/users/search/${encodeURIComponent(name)}`,
          {
            signal,
            headers: { ...headers, token: sessionToken },
          },
        );
        return await parseManyUsersResponse(response);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async getUserById(userId: string, sessionToken: string, signal?: AbortSignal) {
      try {
        const response = await fetch(
          `${config.apiBaseUrl}/users/${encodeURIComponent(userId)}`,
          {
            signal,
            headers: { ...headers, token: sessionToken },
          },
        );
        return await parseGetUserResponse(response);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async createUser(input: CreateUserInput, sessionToken: string, signal?: AbortSignal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/users`, {
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
            ...headers,
            token: sessionToken,
          },
          body: JSON.stringify({
            name: input.name,
            email: input.email,
            phone: input.phone,
            birthday: input.birthday,
            gender: input.gender,
            role: input.role,
            skill: input.skills,
            certification: input.certifications,
          }),
        });
        return await parseSingleUserResponse(response);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async updateUser(
      userId: string,
      input: UpdateUserInput,
      sessionToken: string,
      signal?: AbortSignal,
    ) {
      try {
        const response = await fetch(
          `${config.apiBaseUrl}/users/${encodeURIComponent(userId)}`,
          {
            method: "PUT",
            signal,
            headers: {
              "Content-Type": "application/json",
              ...headers,
              token: sessionToken,
            },
            body: JSON.stringify({
              id: numeric(userId),
              name: input.name,
              email: input.email,
              phone: input.phone,
              birthday: input.birthday,
              gender: input.gender,
              role: input.role,
              skill: input.skills,
              certification: input.certifications,
            }),
          },
        );
        return await parseSingleUserResponse(response);
      } catch (error) {
        throw mutationTransport(error, signal);
      }
    },

    async deleteUser(userId: string, sessionToken: string, signal?: AbortSignal) {
      try {
        const url = new URL(`${config.apiBaseUrl}/users`);
        url.searchParams.set("id", String(numeric(userId)));
        const response = await fetch(url.toString(), {
          method: "DELETE",
          signal,
          headers: { ...headers, token: sessionToken },
        });
        if (!response.ok) throw failure(response.status);
      } catch (error) {
        throw mutationTransport(error, signal);
      }
    },
  };
}
