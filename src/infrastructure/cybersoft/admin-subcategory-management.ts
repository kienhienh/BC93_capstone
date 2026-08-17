import { z } from "zod";
import {
  AdminSubcategoryManagementFailure,
  type AdminCategoryHierarchy,
  type AdminSubcategory,
  type AdminSubcategoryListResult,
  type AdminSubcategoryManagementCapability,
  type AdminTaxonomyCategory,
  type GroupMembershipInput,
  type SubcategoryNameInput,
} from "../../features/admin-subcategory-management/capability";

const idSchema = z.union([z.number().int().nonnegative(), z.string().min(1)]);
const categorySchema = z.object({ id: idSchema, tenLoaiCongViec: z.string().trim().min(1) });
const categoryListEnvelopeSchema = z.object({ content: z.array(categorySchema) });

const subcategorySchema = z.object({ id: idSchema, tenChiTiet: z.string().trim().min(1) });
const subcategoryEnvelopeSchema = z.object({ content: z.union([subcategorySchema, z.array(subcategorySchema)]) });

const groupSnapshotSchema = z.object({
  id: idSchema,
  tenNhom: z.string().trim().min(1),
  hinhAnh: z.string().nullable().optional(),
  maLoaiCongviec: idSchema.optional(),
  maLoaiCongViec: idSchema.optional(),
  dsChiTietLoai: z.array(subcategorySchema),
});
const subcategoryListEnvelopeSchema = z.object({
  content: z.array(z.union([subcategorySchema, groupSnapshotSchema])),
});
const subcategoryPagingEnvelopeSchema = z.object({
  content: z.object({
    pageIndex: z.number().int().nonnegative(),
    pageSize: z.number().int().positive(),
    totalRow: z.number().int().nonnegative(),
    keywords: z.string().nullable().optional(),
    data: z.array(z.union([subcategorySchema, groupSnapshotSchema])),
  }),
});

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

function mapCategory(value: z.infer<typeof categorySchema>): AdminTaxonomyCategory {
  return { id: String(value.id), name: value.tenLoaiCongViec };
}

function mapSubcategory(
  value: z.infer<typeof subcategorySchema>,
  context?: { groupId: string; groupName: string; categoryId?: string },
): AdminSubcategory {
  return {
    id: String(value.id),
    name: value.tenChiTiet,
    ...(context ? {
      groupId: context.groupId,
      groupName: context.groupName,
      ...(context.categoryId ? { categoryId: context.categoryId } : {}),
    } : {}),
  };
}

function flattenSubcategoryItems(
  values: readonly (z.infer<typeof subcategorySchema> | z.infer<typeof groupSnapshotSchema>)[],
): AdminSubcategory[] {
  return values.flatMap((value) => {
    if ("dsChiTietLoai" in value) {
      const rawCategoryId = value.maLoaiCongviec ?? value.maLoaiCongViec;
      const categoryId = rawCategoryId === undefined ? undefined : String(rawCategoryId);
      return value.dsChiTietLoai.map((subcategory) => mapSubcategory(subcategory, {
        groupId: String(value.id),
        groupName: value.tenNhom,
        categoryId,
      }));
    }
    return [mapSubcategory(value)];
  });
}

function mapHierarchy(categoryId: string, value?: z.infer<typeof hierarchyCategorySchema>): AdminCategoryHierarchy {
  return {
    categoryId,
    categoryName: value?.tenLoaiCongViec ?? "",
    groups: value?.dsNhomChiTietLoai.map((group) => ({
      id: String(group.id),
      name: group.tenNhom,
      imageUrl: group.hinhAnh?.trim() || null,
      subcategories: group.dsChiTietLoai.map((subcategory) => mapSubcategory(subcategory)),
    })) ?? [],
  };
}

function numericId(value: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new AdminSubcategoryManagementFailure("validation");
  return parsed;
}

function failure(status: number) {
  if (status === 400 || status === 409 || status === 422) return new AdminSubcategoryManagementFailure("validation");
  if (status === 401) return new AdminSubcategoryManagementFailure("unauthorized");
  if (status === 403) return new AdminSubcategoryManagementFailure("forbidden");
  if (status === 404) return new AdminSubcategoryManagementFailure("not_found");
  return new AdminSubcategoryManagementFailure(status >= 500 ? "server" : "unknown");
}

async function responseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

async function parseAllCategories(response: Response) {
  if (!response.ok) throw failure(response.status);
  const parsed = categoryListEnvelopeSchema.safeParse(await responseJson(response));
  if (!parsed.success) throw new AdminSubcategoryManagementFailure("malformed");
  return parsed.data.content.map(mapCategory);
}

async function parseAllSubcategories(response: Response) {
  if (!response.ok) throw failure(response.status);
  const parsed = subcategoryListEnvelopeSchema.safeParse(await responseJson(response));
  if (!parsed.success) throw new AdminSubcategoryManagementFailure("malformed");
  return flattenSubcategoryItems(parsed.data.content);
}

async function parsePaging(response: Response): Promise<AdminSubcategoryListResult> {
  if (!response.ok) throw failure(response.status);
  const parsed = subcategoryPagingEnvelopeSchema.safeParse(await responseJson(response));
  if (!parsed.success) throw new AdminSubcategoryManagementFailure("malformed");
  const rawData = parsed.data.content.data;
  const data = flattenSubcategoryItems(rawData);
  const lacksHierarchyContext = rawData.some((item) => !("dsChiTietLoai" in item));
  if (parsed.data.content.totalRow > 0 && (rawData.length === 0 || lacksHierarchyContext)) {
    throw new AdminSubcategoryManagementFailure("malformed");
  }
  return {
    pageIndex: parsed.data.content.pageIndex,
    pageSize: parsed.data.content.pageSize,
    totalRow: parsed.data.content.totalRow,
    keywords: parsed.data.content.keywords ?? null,
    scope: "server",
    data,
  };
}

async function parseOneSubcategory(response: Response, requestedId?: string) {
  if (!response.ok) throw failure(response.status);
  const parsed = subcategoryEnvelopeSchema.safeParse(await responseJson(response));
  if (!parsed.success) throw new AdminSubcategoryManagementFailure("malformed");
  const content = parsed.data.content;
  const item = Array.isArray(content)
    ? requestedId ? content.find((subcategory) => String(subcategory.id) === requestedId) : content[0]
    : content;
  if (!item || (requestedId && String(item.id) !== requestedId)) throw new AdminSubcategoryManagementFailure("not_found");
  return mapSubcategory(item);
}

async function parseHierarchy(response: Response, categoryId: string): Promise<AdminCategoryHierarchy> {
  if (!response.ok) throw failure(response.status);
  const parsed = hierarchyEnvelopeSchema.safeParse(await responseJson(response));
  if (!parsed.success) throw new AdminSubcategoryManagementFailure("malformed");
  if (parsed.data.content.length === 0) return mapHierarchy(categoryId);
  const matching = parsed.data.content.find((category) => String(category.id) === categoryId);
  if (!matching) throw new AdminSubcategoryManagementFailure("malformed");
  return mapHierarchy(categoryId, matching);
}

function transport(error: unknown, signal?: AbortSignal) {
  if (error instanceof AdminSubcategoryManagementFailure) return error;
  if (signal?.aborted) return new AdminSubcategoryManagementFailure("cancelled");
  if (typeof navigator !== "undefined" && !navigator.onLine) return new AdminSubcategoryManagementFailure("offline");
  if (error instanceof TypeError) return new AdminSubcategoryManagementFailure("network");
  if (error instanceof SyntaxError) return new AdminSubcategoryManagementFailure("malformed");
  return new AdminSubcategoryManagementFailure("unknown");
}

function mutationTransport(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted) return new AdminSubcategoryManagementFailure("cancelled");
  if (typeof navigator !== "undefined" && !navigator.onLine) return new AdminSubcategoryManagementFailure("offline");
  if (error instanceof AdminSubcategoryManagementFailure) {
    if (["malformed", "network", "unknown"].includes(error.kind)) return new AdminSubcategoryManagementFailure("unknown_outcome");
    return error;
  }
  if (error instanceof TypeError || error instanceof SyntaxError) return new AdminSubcategoryManagementFailure("unknown_outcome");
  return new AdminSubcategoryManagementFailure("unknown_outcome");
}

export function createCybersoftAdminSubcategoryManagementCapability(config: {
  apiBaseUrl: string;
  cybersoftToken: string;
}): AdminSubcategoryManagementCapability {
  const baseHeaders = { tokenCybersoft: config.cybersoftToken };
  const authHeaders = (sessionToken: string) => ({ ...baseHeaders, token: sessionToken });

  return {
    async listAllCategories(sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/loai-cong-viec`, { signal, headers: authHeaders(sessionToken) });
        return await parseAllCategories(response);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async getCategoryHierarchy(categoryId, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/cong-viec/lay-chi-tiet-loai-cong-viec/${encodeURIComponent(categoryId)}`, {
          signal,
          headers: authHeaders(sessionToken),
        });
        return await parseHierarchy(response, categoryId);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async listAllSubcategories(sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/chi-tiet-loai-cong-viec`, { signal, headers: authHeaders(sessionToken) });
        return await parseAllSubcategories(response);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async listSubcategories(params, sessionToken, signal) {
      try {
        const url = new URL(`${config.apiBaseUrl}/chi-tiet-loai-cong-viec/phan-trang-tim-kiem`);
        url.searchParams.set("pageIndex", String(params.pageIndex));
        url.searchParams.set("pageSize", String(params.pageSize));
        if (params.keyword) url.searchParams.set("keyword", params.keyword);
        const response = await fetch(url.toString(), { signal, headers: authHeaders(sessionToken) });
        try {
          return await parsePaging(response);
        } catch (error) {
          if (!(error instanceof AdminSubcategoryManagementFailure) || error.kind !== "malformed") throw error;
          const fallbackResponse = await fetch(`${config.apiBaseUrl}/chi-tiet-loai-cong-viec`, { signal, headers: authHeaders(sessionToken) });
          const all = await parseAllSubcategories(fallbackResponse);
          const needle = params.keyword?.trim().toLocaleLowerCase() ?? "";
          const filtered = needle ? all.filter((item) => item.name.toLocaleLowerCase().includes(needle)) : all;
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
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async getSubcategoryById(id, sessionToken, signal) {
      try {
        // The published GET /chi-tiet-loai-cong-viec/{id} response is a Service Group,
        // not a selectable leaf. Resolve a Subcategory from the complete Group snapshot
        // so detail/edit safeguards never misinterpret a Group as a Subcategory.
        const response = await fetch(`${config.apiBaseUrl}/chi-tiet-loai-cong-viec`, {
          signal,
          headers: authHeaders(sessionToken),
        });
        const all = await parseAllSubcategories(response);
        const item = all.find((subcategory) => subcategory.id === id);
        if (!item) throw new AdminSubcategoryManagementFailure("not_found");
        return item;
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async createSubcategory(input: SubcategoryNameInput, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/chi-tiet-loai-cong-viec`, {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json", ...authHeaders(sessionToken) },
          body: JSON.stringify({ tenChiTiet: input.name }),
        });
        return await parseOneSubcategory(response);
      } catch (error) {
        throw mutationTransport(error, signal);
      }
    },

    async updateSubcategory(id, input: SubcategoryNameInput, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/chi-tiet-loai-cong-viec/${encodeURIComponent(id)}`, {
          method: "PUT",
          signal,
          headers: { "Content-Type": "application/json", ...authHeaders(sessionToken) },
          body: JSON.stringify({ id: numericId(id), tenChiTiet: input.name }),
        });
        return await parseOneSubcategory(response, id);
      } catch (error) {
        throw mutationTransport(error, signal);
      }
    },

    async deleteSubcategory(id, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/chi-tiet-loai-cong-viec/${encodeURIComponent(id)}`, {
          method: "DELETE",
          signal,
          headers: authHeaders(sessionToken),
        });
        if (!response.ok) throw failure(response.status);
      } catch (error) {
        throw mutationTransport(error, signal);
      }
    },

    async createGroup(input: GroupMembershipInput, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/chi-tiet-loai-cong-viec/them-nhom-chi-tiet-loai`, {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json", ...authHeaders(sessionToken) },
          body: JSON.stringify({
            tenChiTiet: input.name,
            maLoaiCongViec: numericId(input.categoryId),
            danhSachChiTiet: input.subcategoryIds.map((id) => numericId(id)),
          }),
        });
        if (!response.ok) throw failure(response.status);
      } catch (error) {
        throw mutationTransport(error, signal);
      }
    },

    async updateGroup(groupId, input: GroupMembershipInput, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/chi-tiet-loai-cong-viec/sua-nhom-chi-tiet-loai/${encodeURIComponent(groupId)}`, {
          method: "PUT",
          signal,
          headers: { "Content-Type": "application/json", ...authHeaders(sessionToken) },
          body: JSON.stringify({
            id: numericId(groupId),
            tenChiTiet: input.name,
            maLoaiCongViec: numericId(input.categoryId),
            danhSachChiTiet: input.subcategoryIds.map((id) => numericId(id)),
          }),
        });
        if (!response.ok) throw failure(response.status);
      } catch (error) {
        throw mutationTransport(error, signal);
      }
    },
  };
}
