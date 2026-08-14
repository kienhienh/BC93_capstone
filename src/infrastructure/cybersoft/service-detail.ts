import { z } from "zod";
import {
  ServiceDetailFailure,
  type ServiceComment,
  type ServiceDetail,
  type ServiceDetailCapability,
} from "../../features/service-detail/capability";

const idSchema = z.union([z.number().int().nonnegative(), z.string().min(1)]);
const optionalText = z.preprocess(
  (value) => typeof value === "string" && value.trim().length === 0 ? null : value,
  z.string().trim().min(1).nullable().optional(),
);
const optionalCommentRating = z.preprocess(
  (value) => typeof value === "number" && (!Number.isFinite(value) || value < 0 || value > 5)
    ? null
    : value,
  z.number().finite().min(0).max(5).nullable().optional(),
);

const serviceDetailSchema = z.object({
  congViec: z.object({
    id: idSchema,
    tenCongViec: z.string().trim().min(1),
    danhGia: z.number().int().nonnegative().nullable().optional(),
    giaTien: z.number().finite().nonnegative(),
    nguoiTao: idSchema.nullable().optional(),
    hinhAnh: optionalText,
    moTa: z.string().default(""),
    moTaNgan: optionalText,
    saoCongViec: z.number().finite().min(0).max(5).nullable().optional(),
  }),
  tenLoaiCongViec: optionalText,
  tenNhomChiTietLoai: optionalText,
  tenChiTietLoai: optionalText,
  tenNguoiTao: optionalText,
  avatar: optionalText,
});

const detailEnvelopeSchema = z.object({ content: z.array(serviceDetailSchema) });
const commentSchema = z.object({
  id: idSchema,
  ngayBinhLuan: optionalText,
  noiDung: z.string().default(""),
  saoBinhLuan: optionalCommentRating,
  tenNguoiBinhLuan: optionalText,
  avatar: optionalText,
});
const commentsEnvelopeSchema = z.object({ content: z.array(commentSchema) });

function normalizeFailure(error: unknown) {
  if (error instanceof ServiceDetailFailure) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ServiceDetailFailure("cancelled", "The request was cancelled.");
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return new ServiceDetailFailure("offline", "The browser is offline.");
  }
  if (error instanceof TypeError) {
    return new ServiceDetailFailure("network", "The request could not connect.");
  }
  return new ServiceDetailFailure("unknown", "The request failed.");
}

async function parseResponse(response: Response, resource: "Service" | "Comments") {
  if (!response.ok) {
    if (resource === "Service" && response.status === 404) {
      throw new ServiceDetailFailure("not_found", "The Service does not exist.");
    }
    throw new ServiceDetailFailure(
      response.status >= 500 ? "server" : "unknown",
      `${resource} returned an unsuccessful response.`,
    );
  }
  try {
    return await response.json() as unknown;
  } catch {
    throw new ServiceDetailFailure("malformed", `${resource} returned invalid JSON.`);
  }
}

export function createCybersoftServiceDetailCapability(config: {
  apiBaseUrl: string;
  cybersoftToken: string;
}): ServiceDetailCapability {
  const headers = { tokenCybersoft: config.cybersoftToken };
  return {
    async getService(serviceId, signal) {
      try {
        const response = await fetch(
          `${config.apiBaseUrl}/cong-viec/lay-cong-viec-chi-tiet/${encodeURIComponent(serviceId)}`,
          { signal, headers },
        );
        const parsed = detailEnvelopeSchema.safeParse(await parseResponse(response, "Service"));
        if (!parsed.success) throw new ServiceDetailFailure("malformed", "Service returned unsafe data.");
        const item = parsed.data.content[0];
        if (!item) throw new ServiceDetailFailure("not_found", "The Service does not exist.");
        const dto = item.congViec;
        const sellerId = dto.nguoiTao === null || dto.nguoiTao === undefined
          ? null
          : String(dto.nguoiTao);
        return {
          id: String(dto.id),
          title: dto.tenCongViec,
          description: dto.moTa,
          shortDescription: dto.moTaNgan ?? null,
          price: dto.giaTien,
          imageUrl: dto.hinhAnh ?? null,
          rating: dto.saoCongViec ?? null,
          ratingCount: dto.danhGia ?? null,
          categoryName: item.tenLoaiCongViec ?? null,
          groupName: item.tenNhomChiTietLoai ?? null,
          subcategoryName: item.tenChiTietLoai ?? null,
          seller: sellerId || item.tenNguoiTao || item.avatar
            ? { id: sellerId ?? "unknown", name: item.tenNguoiTao ?? null, avatarUrl: item.avatar ?? null }
            : null,
        } satisfies ServiceDetail;
      } catch (error) {
        if (signal.aborted) throw new ServiceDetailFailure("cancelled", "The request was cancelled.");
        throw normalizeFailure(error);
      }
    },

    async listComments(serviceId, signal) {
      try {
        const response = await fetch(
          `${config.apiBaseUrl}/binh-luan/lay-binh-luan-theo-cong-viec/${encodeURIComponent(serviceId)}`,
          { signal, headers },
        );
        const parsed = commentsEnvelopeSchema.safeParse(await parseResponse(response, "Comments"));
        if (!parsed.success) throw new ServiceDetailFailure("malformed", "Comments returned unsafe data.");
        return parsed.data.content.map((comment): ServiceComment => ({
          id: String(comment.id),
          authorName: comment.tenNguoiBinhLuan ?? null,
          avatarUrl: comment.avatar ?? null,
          content: comment.noiDung,
          rating: comment.saoBinhLuan ?? null,
          createdAt: comment.ngayBinhLuan ?? null,
        }));
      } catch (error) {
        if (signal.aborted) throw new ServiceDetailFailure("cancelled", "The request was cancelled.");
        throw normalizeFailure(error);
      }
    },
  };
}
