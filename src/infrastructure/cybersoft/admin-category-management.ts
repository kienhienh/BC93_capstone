import { z } from "zod";
import {
  AdminCategoryManagementFailure,
  type AdminCategoryHierarchy,
  type AdminCategoryListParams,
  type AdminCategoryListResult,
  type AdminCategoryManagementCapability,
  type AdminServiceCategory,
  type CategoryNameInput,
} from "../../features/admin-category-management/wiring";

const idSchema = z.union([z.number().int().nonnegative(), z.string().min(1)]);
const categorySchema = z.object({ id: idSchema, tenLoaiCongViec: z.string().trim().min(1) });
const categoryEnvelopeSchema = z.object({ content: z.union([categorySchema, z.array(categorySchema)]) });
const categoryListEnvelopeSchema = z.object({ content: z.array(categorySchema) });
const categoryPagingEnvelopeSchema = z.object({
  content: z.object({
    pageIndex: z.number().int().nonnegative(),
    pageSize: z.number().int().positive(),
    totalRow: z.number().int().nonnegative(),
    keywords: z.string().nullable().optional(),
    data: z.array(categorySchema),
  }),
});
const subcategorySchema = z.object({ id: idSchema, tenChiTiet: z.string().trim().min(1) });
const groupSchema = z.object({
  id: idSchema,
  tenNhom: z.string().trim().min(1),
  hinhAnh: z.string().nullable().optional(),
  dsChiTietLoai: z.array(subcategorySchema),
});
const hierarchyCategorySchema = z.object({
  id: idSchema,
  tenLoaiCongViec: z.string().trim().min(1),
  dsNhomChiTietLoai: z.array(groupSchema),
});
const hierarchyEnvelopeSchema = z.object({ content: z.array(hierarchyCategorySchema) });

function mapCategory(value: z.infer<typeof categorySchema>): AdminServiceCategory {
  return { id: String(value.id), name: value.tenLoaiCongViec };
}

function mapHierarchy(categoryId: string, value?: z.infer<typeof hierarchyCategorySchema>): AdminCategoryHierarchy {
  return {
    categoryId,
    groups: value?.dsNhomChiTietLoai.map((group) => ({
      id: String(group.id),
      name: group.tenNhom,
      imageUrl: group.hinhAnh?.trim() || null,
      subcategories: group.dsChiTietLoai.map((subcategory) => ({
        id: String(subcategory.id),
        name: subcategory.tenChiTiet,
      })),
    })) ?? [],
  };
}

function numericId(value: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new AdminCategoryManagementFailure("validation");
  return parsed;
}

function failure(status: number) {
  if (status === 400 || status === 409 || status === 422) return new AdminCategoryManagementFailure("validation");
  if (status === 401) return new AdminCategoryManagementFailure("unauthorized");
  if (status === 403) return new AdminCategoryManagementFailure("forbidden");
  if (status === 404) return new AdminCategoryManagementFailure("not_found");
  return new AdminCategoryManagementFailure(status >= 500 ? "server" : "unknown");
}

async function responseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

async function parseAll(response: Response) {
  if (!response.ok) throw failure(response.status);
  const parsed = categoryListEnvelopeSchema.safeParse(await responseJson(response));
  if (!parsed.success) throw new AdminCategoryManagementFailure("malformed");
  return parsed.data.content.map(mapCategory);
}

async function parsePaging(response: Response): Promise<AdminCategoryListResult> {
  if (!response.ok) throw failure(response.status);
  const parsed = categoryPagingEnvelopeSchema.safeParse(await responseJson(response));
  if (!parsed.success) throw new AdminCategoryManagementFailure("malformed");
  return {
    pageIndex: parsed.data.content.pageIndex,
    pageSize: parsed.data.content.pageSize,
    totalRow: parsed.data.content.totalRow,
    keywords: parsed.data.content.keywords ?? null,
    scope: "server",
    data: parsed.data.content.data.map(mapCategory),
  };
}

async function parseOne(response: Response, requestedId?: string) {
  if (!response.ok) throw failure(response.status);
  const parsed = categoryEnvelopeSchema.safeParse(await responseJson(response));
  if (!parsed.success) throw new AdminCategoryManagementFailure("malformed");
  const content = parsed.data.content;
  const item = Array.isArray(content)
    ? requestedId ? content.find((category) => String(category.id) === requestedId) : content[0]
    : content;
  if (!item || (requestedId && String(item.id) !== requestedId)) throw new AdminCategoryManagementFailure("not_found");
  return mapCategory(item);
}

async function parseHierarchy(response: Response, categoryId: string): Promise<AdminCategoryHierarchy> {
  if (!response.ok) throw failure(response.status);
  const parsed = hierarchyEnvelopeSchema.safeParse(await responseJson(response));
  if (!parsed.success) throw new AdminCategoryManagementFailure("malformed");
  if (parsed.data.content.length === 0) return mapHierarchy(categoryId);
  const matching = parsed.data.content.find((category) => String(category.id) === categoryId);
  if (!matching) throw new AdminCategoryManagementFailure("malformed");
  return mapHierarchy(categoryId, matching);
}

function transport(error: unknown, signal?: AbortSignal) {
  if (error instanceof AdminCategoryManagementFailure) return error;
  if (signal?.aborted) return new AdminCategoryManagementFailure("cancelled");
  if (typeof navigator !== "undefined" && !navigator.onLine) return new AdminCategoryManagementFailure("offline");
  if (error instanceof TypeError) return new AdminCategoryManagementFailure("network");
  if (error instanceof SyntaxError) return new AdminCategoryManagementFailure("malformed");
  return new AdminCategoryManagementFailure("unknown");
}

function mutationTransport(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted) return new AdminCategoryManagementFailure("cancelled");
  if (typeof navigator !== "undefined" && !navigator.onLine) return new AdminCategoryManagementFailure("offline");
  if (error instanceof AdminCategoryManagementFailure) {
    if (["malformed", "network", "unknown"].includes(error.kind)) return new AdminCategoryManagementFailure("unknown_outcome");
    return error;
  }
  if (error instanceof TypeError || error instanceof SyntaxError) return new AdminCategoryManagementFailure("unknown_outcome");
  return new AdminCategoryManagementFailure("unknown_outcome");
}

function clientFallback(categories: readonly AdminServiceCategory[], params: AdminCategoryListParams): AdminCategoryListResult {
  const needle = params.keyword?.trim().toLocaleLowerCase() ?? "";
  const filtered = needle ? categories.filter((category) => category.name.toLocaleLowerCase().includes(needle)) : [...categories];
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

export function createCybersoftAdminCategoryManagementCapability(config: {
  apiBaseUrl: string;
  cybersoftToken: string;
}): AdminCategoryManagementCapability {
  const baseHeaders = { tokenCybersoft: config.cybersoftToken };
  const authHeaders = (sessionToken: string) => ({ ...baseHeaders, token: sessionToken });

  return {
    async listAllCategories(sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/loai-cong-viec`, { signal, headers: authHeaders(sessionToken) });
        return await parseAll(response);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async listCategories(params, sessionToken, signal) {
      try {
        const url = new URL(`${config.apiBaseUrl}/loai-cong-viec/phan-trang-tim-kiem`);
        url.searchParams.set("pageIndex", String(params.pageIndex));
        url.searchParams.set("pageSize", String(params.pageSize));
        if (params.keyword) url.searchParams.set("keyword", params.keyword);
        const response = await fetch(url.toString(), { signal, headers: authHeaders(sessionToken) });
        try {
          return await parsePaging(response);
        } catch (error) {
          if (!(error instanceof AdminCategoryManagementFailure) || error.kind !== "malformed") throw error;
          const fallbackResponse = await fetch(`${config.apiBaseUrl}/loai-cong-viec`, { signal, headers: authHeaders(sessionToken) });
          return clientFallback(await parseAll(fallbackResponse), params);
        }
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async getCategoryById(id, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/loai-cong-viec/${encodeURIComponent(id)}`, {
          signal,
          headers: authHeaders(sessionToken),
        });
        return await parseOne(response, id);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async getCategoryHierarchy(id, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/cong-viec/lay-chi-tiet-loai-cong-viec/${encodeURIComponent(id)}`, {
          signal,
          headers: authHeaders(sessionToken),
        });
        return await parseHierarchy(response, id);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async createCategory(input: CategoryNameInput, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/loai-cong-viec`, {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json", ...authHeaders(sessionToken) },
          body: JSON.stringify({ tenLoaiCongViec: input.name }),
        });
        return await parseOne(response);
      } catch (error) {
        throw mutationTransport(error, signal);
      }
    },

    async updateCategory(id, input: CategoryNameInput, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/loai-cong-viec/${encodeURIComponent(id)}`, {
          method: "PUT",
          signal,
          headers: { "Content-Type": "application/json", ...authHeaders(sessionToken) },
          body: JSON.stringify({ id: numericId(id), tenLoaiCongViec: input.name }),
        });
        return await parseOne(response, id);
      } catch (error) {
        throw mutationTransport(error, signal);
      }
    },

    async deleteCategory(id, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/loai-cong-viec/${encodeURIComponent(id)}`, {
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
