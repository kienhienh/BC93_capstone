import { z } from "zod";
import {
  AdminServiceManagementFailure,
  type AdminService,
  type AdminServiceListParams,
  type AdminServiceListResult,
  type AdminServiceManagementCapability,
  type CreateServiceInput,
  type UpdateServiceInput,
} from "../../features/admin-service-management/capability";

const id = z.union([z.string(), z.number()]);

const looseString = z
  .union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])
  .transform((value) => (value == null ? "" : String(value)));

const nullableString = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => (value == null || value === "" ? null : String(value)));

const numberish = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value, context) => {
    const result = value == null ? 0 : typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(result)) {
      context.addIssue({ code: "custom", message: "Expected a finite number" });
      return z.NEVER;
    }
    return result;
  });

/**
 * Read-side parsing is intentionally tolerant of legacy/dirty Service records
 * (the same philosophy as admin-user-management) so one bad record can't make
 * the whole Service list look malformed. Join-only fields (seller name/avatar,
 * category/group/subcategory names) are present on detail/search-by-name but
 * absent on the plain list endpoint, so they stay optional here.
 */
const serviceSchema = z.object({
  id,
  tenCongViec: looseString,
  moTa: looseString,
  moTaNgan: looseString,
  giaTien: numberish,
  hinhAnh: nullableString,
  saoCongViec: numberish,
  danhGia: numberish,
  nguoiTao: id,
  maChiTietLoaiCongViec: id,
  tenNguoiTao: looseString.optional(),
  avatar: nullableString.optional(),
  tenLoaiCongViec: looseString.optional(),
  tenNhomChiTietLoai: looseString.optional(),
  tenChiTietLoai: looseString.optional(),
}).passthrough();

const keyword = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => (value == null || value === "" ? null : String(value)));

const serviceListResponseSchema = z.object({
  content: z.object({
    pageIndex: numberish,
    pageSize: numberish,
    totalRow: numberish,
    keywords: keyword.optional(),
    data: z.array(serviceSchema),
  }).passthrough(),
}).passthrough();

const manyServicesResponseSchema = z.object({
  content: z.array(serviceSchema),
}).passthrough();

const singleServiceResponseSchema = z.object({
  content: serviceSchema,
}).passthrough();

const oneOrManyServiceResponseSchema = z.object({
  content: z.union([serviceSchema, z.array(serviceSchema)]),
}).passthrough();

const hireSchema = z.object({
  id,
  maCongViec: id,
  maNguoiThue: id.optional(),
  ngayThue: looseString.optional(),
  hoanThanh: z.unknown().optional(),
}).passthrough();

const hireListResponseSchema = z.object({
  content: z.array(hireSchema),
}).passthrough();

function clampRating(value: number): number {
  return Math.min(5, Math.max(0, value));
}

function mapToAdminService(value: z.infer<typeof serviceSchema>): AdminService {
  return {
    id: String(value.id),
    title: value.tenCongViec,
    description: value.moTa,
    shortDescription: value.moTaNgan,
    price: value.giaTien,
    imageUrl: value.hinhAnh,
    rating: clampRating(value.saoCongViec),
    reviewCount: value.danhGia,
    sellerId: String(value.nguoiTao),
    sellerName: value.tenNguoiTao ?? null,
    subcategoryId: String(value.maChiTietLoaiCongViec),
    categoryName: value.tenLoaiCongViec ?? null,
    groupName: value.tenNhomChiTietLoai ?? null,
    subcategoryName: value.tenChiTietLoai ?? null,
  };
}

function numeric(value: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new AdminServiceManagementFailure("malformed");
  return result;
}

function failure(status: number): AdminServiceManagementFailure {
  if (status === 401) return new AdminServiceManagementFailure("unauthorized");
  if (status === 403) return new AdminServiceManagementFailure("forbidden");
  if (status === 404) return new AdminServiceManagementFailure("not_found");
  return new AdminServiceManagementFailure(status >= 500 ? "server" : "unknown");
}

async function responseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

async function parseListResponse(response: Response): Promise<AdminServiceListResult> {
  if (!response.ok) throw failure(response.status);
  const parsed = serviceListResponseSchema.safeParse(await responseJson(response));
  if (!parsed.success) throw new AdminServiceManagementFailure("malformed");
  return {
    pageIndex: parsed.data.content.pageIndex,
    pageSize: parsed.data.content.pageSize,
    totalRow: parsed.data.content.totalRow,
    keywords: parsed.data.content.keywords ?? null,
    scope: "server",
    data: parsed.data.content.data.map(mapToAdminService),
  };
}

async function parseManyServicesResponse(response: Response): Promise<readonly AdminService[]> {
  if (!response.ok) throw failure(response.status);
  const parsed = manyServicesResponseSchema.safeParse(await responseJson(response));
  if (!parsed.success) throw new AdminServiceManagementFailure("malformed");
  return parsed.data.content.map(mapToAdminService);
}

async function parseSingleServiceResponse(response: Response): Promise<AdminService> {
  if (!response.ok) throw failure(response.status);
  const parsed = singleServiceResponseSchema.safeParse(await responseJson(response));
  if (!parsed.success) throw new AdminServiceManagementFailure("malformed");
  return mapToAdminService(parsed.data.content);
}

async function parseGetServiceResponse(response: Response): Promise<AdminService> {
  if (!response.ok) throw failure(response.status);
  const parsed = oneOrManyServiceResponseSchema.safeParse(await responseJson(response));
  if (!parsed.success) throw new AdminServiceManagementFailure("malformed");
  const first = Array.isArray(parsed.data.content) ? parsed.data.content[0] : parsed.data.content;
  if (!first) throw new AdminServiceManagementFailure("not_found");
  return mapToAdminService(first);
}

function transport(error: unknown, signal?: AbortSignal): AdminServiceManagementFailure {
  if (error instanceof AdminServiceManagementFailure) return error;
  if (signal?.aborted) return new AdminServiceManagementFailure("cancelled");
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return new AdminServiceManagementFailure("offline");
  }
  if (error instanceof TypeError) return new AdminServiceManagementFailure("network");
  return new AdminServiceManagementFailure("unknown");
}

function mutationTransport(error: unknown, signal?: AbortSignal): AdminServiceManagementFailure {
  if (signal?.aborted) return new AdminServiceManagementFailure("cancelled");
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return new AdminServiceManagementFailure("offline");
  }
  if (error instanceof AdminServiceManagementFailure) {
    if (error.kind === "malformed" || error.kind === "network" || error.kind === "unknown") {
      return new AdminServiceManagementFailure("unknown_outcome");
    }
    return error;
  }
  if (error instanceof TypeError) return new AdminServiceManagementFailure("unknown_outcome");
  return new AdminServiceManagementFailure("unknown_outcome");
}

function clientFallbackList(
  services: readonly AdminService[],
  params: AdminServiceListParams,
): AdminServiceListResult {
  const query = params.keyword?.trim().toLowerCase() ?? "";
  const filtered = query
    ? services.filter((service) =>
        service.title.toLowerCase().includes(query)
        || service.shortDescription.toLowerCase().includes(query))
    : [...services];
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

export function createCybersoftAdminServiceManagementCapability(config: {
  apiBaseUrl: string;
  cybersoftToken: string;
}): AdminServiceManagementCapability {
  const headers = { tokenCybersoft: config.cybersoftToken };

  return {
    async listAllServices(sessionToken: string, signal?: AbortSignal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/cong-viec`, {
          signal,
          headers: { ...headers, token: sessionToken },
        });
        return await parseManyServicesResponse(response);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async listServices(params: AdminServiceListParams, sessionToken: string, signal?: AbortSignal) {
      try {
        const url = new URL(`${config.apiBaseUrl}/cong-viec/phan-trang-tim-kiem`);
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
          if (!(error instanceof AdminServiceManagementFailure) || error.kind !== "malformed") throw error;
          const fallbackResponse = await fetch(`${config.apiBaseUrl}/cong-viec`, {
            signal,
            headers: { ...headers, token: sessionToken },
          });
          return clientFallbackList(await parseManyServicesResponse(fallbackResponse), params);
        }
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async searchServicesByName(name: string, sessionToken: string, signal?: AbortSignal) {
      try {
        const response = await fetch(
          `${config.apiBaseUrl}/cong-viec/lay-danh-sach-cong-viec-theo-ten/${encodeURIComponent(name)}`,
          { signal, headers: { ...headers, token: sessionToken } },
        );
        return await parseManyServicesResponse(response);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async getServiceById(serviceId: string, sessionToken: string, signal?: AbortSignal) {
      try {
        const response = await fetch(
          `${config.apiBaseUrl}/cong-viec/${encodeURIComponent(serviceId)}`,
          { signal, headers: { ...headers, token: sessionToken } },
        );
        return await parseGetServiceResponse(response);
      } catch (error) {
        throw transport(error, signal);
      }
    },

    async createService(input: CreateServiceInput, sessionToken: string, signal?: AbortSignal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/cong-viec`, {
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
            ...headers,
            token: sessionToken,
          },
          body: JSON.stringify({
            tenCongViec: input.title,
            moTa: input.description,
            moTaNgan: input.shortDescription,
            giaTien: input.price,
            nguoiTao: numeric(input.sellerId),
            maChiTietLoaiCongViec: numeric(input.subcategoryId),
            saoCongViec: input.rating,
            danhGia: 0,
          }),
        });
        return await parseSingleServiceResponse(response);
      } catch (error) {
        throw mutationTransport(error, signal);
      }
    },

    async updateService(
      serviceId: string,
      input: UpdateServiceInput,
      sessionToken: string,
      signal?: AbortSignal,
    ) {
      try {
        const response = await fetch(
          `${config.apiBaseUrl}/cong-viec/${encodeURIComponent(serviceId)}`,
          {
            method: "PUT",
            signal,
            headers: {
              "Content-Type": "application/json",
              ...headers,
              token: sessionToken,
            },
            body: JSON.stringify({
              id: numeric(serviceId),
              tenCongViec: input.title,
              moTa: input.description,
              moTaNgan: input.shortDescription,
              giaTien: input.price,
              nguoiTao: numeric(input.sellerId),
              maChiTietLoaiCongViec: numeric(input.subcategoryId),
              saoCongViec: input.rating,
              danhGia: input.reviewCount,
            }),
          },
        );
        return await parseSingleServiceResponse(response);
      } catch (error) {
        throw mutationTransport(error, signal);
      }
    },

    async deleteService(serviceId: string, sessionToken: string, signal?: AbortSignal) {
      try {
        const response = await fetch(
          `${config.apiBaseUrl}/cong-viec/${encodeURIComponent(serviceId)}`,
          {
            method: "DELETE",
            signal,
            headers: { ...headers, token: sessionToken },
          },
        );
        if (!response.ok) throw failure(response.status);
      } catch (error) {
        throw mutationTransport(error, signal);
      }
    },

    async uploadServiceImage(serviceId: string, file: File, sessionToken: string, signal?: AbortSignal) {
      try {
        const body = new FormData();
        body.append("formFile", file);
        const response = await fetch(
          `${config.apiBaseUrl}/cong-viec/upload-hinh-cong-viec/${encodeURIComponent(serviceId)}`,
          {
            method: "POST",
            signal,
            headers: { ...headers, token: sessionToken },
            body,
          },
        );
        return await parseSingleServiceResponse(response);
      } catch (error) {
        throw mutationTransport(error, signal);
      }
    },

    async hasHiresForService(serviceId: string, sessionToken: string, signal?: AbortSignal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/thue-cong-viec`, {
          signal,
          headers: { ...headers, token: sessionToken },
        });
        if (!response.ok) throw failure(response.status);
        const parsed = hireListResponseSchema.safeParse(await responseJson(response));
        if (!parsed.success) throw new AdminServiceManagementFailure("malformed");
        return parsed.data.content.some((hire) => String(hire.maCongViec) === serviceId);
      } catch (error) {
        throw mutationTransport(error, signal);
      }
    },
  };
}
