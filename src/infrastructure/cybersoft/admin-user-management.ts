import { z } from "zod";
import {
  AdminUserManagementFailure,
  type AdminUser,
  type AdminUserListResult,
  type AdminUserManagementCapability,
  type CreateUserInput,
  type AdminUserListParams,
} from "../../features/admin-user-management/capability";

const id = z.union([z.string(), z.number()]);
const list = z
  .union([z.array(z.string()), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (Array.isArray(value)) return value;
    if (!value || value === "null") return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [value];
    } catch {
      return [value];
    }
  });

const userSchema = z.object({
  id,
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  birthday: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  gender: z.boolean().nullable().optional(),
  role: z.preprocess(
    (value) => (typeof value === "string" ? value.toUpperCase() : value),
    z.enum(["USER", "ADMIN"]).nullable().optional(),
  ),
  skill: list,
  certification: list,
});

const userListResponseSchema = z.object({
  content: z.object({
    pageIndex: z.number(),
    pageSize: z.number(),
    totalRow: z.number(),
    keywords: z.string().nullable(),
    data: z.array(userSchema),
  }),
});

const singleUserResponseSchema = z.object({
  content: userSchema,
});

const userListSchema = z.array(userSchema);
const singleUserListResponseSchema = z.object({
  content: userListSchema,
});

function mapToAdminUser(value: z.infer<typeof userSchema>): AdminUser {
  return {
    id: String(value.id),
    name: value.name,
    email: value.email,
    phone: value.phone ?? "",
    birthday: value.birthday?.slice(0, 10) ?? "",
    avatar: value.avatar ?? null,
    gender: value.gender ?? true,
    role: (value.role ?? "USER") as "USER" | "ADMIN",
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
  return new AdminUserManagementFailure(
    status >= 500 ? "server" : "unknown",
  );
}

async function parseListResponse(response: Response): Promise<AdminUserListResult> {
  if (!response.ok) throw failure(response.status);
  const parsed = userListResponseSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (!parsed.success) throw new AdminUserManagementFailure("malformed");
  return {
    pageIndex: parsed.data.content.pageIndex,
    pageSize: parsed.data.content.pageSize,
    totalRow: parsed.data.content.totalRow,
    keywords: parsed.data.content.keywords,
    data: parsed.data.content.data.map(mapToAdminUser),
  };
}

async function parseSingleUserResponse(response: Response): Promise<AdminUser> {
  if (!response.ok) throw failure(response.status);
  const parsed = singleUserResponseSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (!parsed.success) throw new AdminUserManagementFailure("malformed");
  return mapToAdminUser(parsed.data.content);
}

async function parseSingleUserListResponse(response: Response): Promise<AdminUser> {
  if (!response.ok) throw failure(response.status);
  const parsed = singleUserListResponseSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (!parsed.success) throw new AdminUserManagementFailure("malformed");
  if (parsed.data.content.length === 0) {
    throw new AdminUserManagementFailure("not_found");
  }
  return mapToAdminUser(parsed.data.content[0]);
}

function transport(
  error: unknown,
  signal?: AbortSignal,
): AdminUserManagementFailure {
  if (error instanceof AdminUserManagementFailure) return error;
  if (signal?.aborted) return new AdminUserManagementFailure("cancelled");
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return new AdminUserManagementFailure("offline");
  }
  if (error instanceof TypeError) return new AdminUserManagementFailure("network");
  return new AdminUserManagementFailure("unknown");
}

export function createCybersoftAdminUserManagementCapability(config: {
  apiBaseUrl: string;
  cybersoftToken: string;
}): AdminUserManagementCapability {
  const headers = { tokenCybersoft: config.cybersoftToken };

  return {
    async listUsers(params: AdminUserListParams, sessionToken: string, signal?: AbortSignal) {
      try {
        const url = new URL(`${config.apiBaseUrl}/users/phan-trang-tim-kiem`);
        url.searchParams.set("pageIndex", String(params.pageIndex));
        url.searchParams.set("pageSize", String(params.pageSize));
        if (params.keyword) {
          url.searchParams.set("keyword", params.keyword);
        }
        const response = await fetch(url.toString(), {
          signal,
          headers: { ...headers, token: sessionToken },
        });
        return await parseListResponse(response);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async getUserById(id: string, sessionToken: string, signal?: AbortSignal) {
      try {
        const response = await fetch(
          `${config.apiBaseUrl}/users/${encodeURIComponent(id)}`,
          {
            signal,
            headers: { ...headers, token: sessionToken },
          },
        );
        return await parseSingleUserListResponse(response);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async createUser(
      input: CreateUserInput,
      sessionToken: string,
      signal?: AbortSignal,
    ) {
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
      id: string,
      input: Partial<CreateUserInput>,
      sessionToken: string,
      signal?: AbortSignal,
    ) {
      try {
        const response = await fetch(
          `${config.apiBaseUrl}/users/${encodeURIComponent(id)}`,
          {
            method: "PUT",
            signal,
            headers: {
              "Content-Type": "application/json",
              ...headers,
              token: sessionToken,
            },
            body: JSON.stringify({
              id: numeric(id),
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
        throw transport(error, signal);
      }
    },

    async deleteUser(
      id: string,
      sessionToken: string,
      signal?: AbortSignal,
    ) {
      try {
        const url = new URL(`${config.apiBaseUrl}/users`);
        url.searchParams.set("id", String(numeric(id)));
        const response = await fetch(url.toString(), {
          method: "DELETE",
          signal,
          headers: { ...headers, token: sessionToken },
        });
        if (!response.ok) throw failure(response.status);
      } catch (error) {
        throw transport(error, signal);
      }
    },
  };
}
