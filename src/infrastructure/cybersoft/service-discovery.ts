import { z } from "zod";
import {
  ServiceDiscoveryFailure,
  type ServiceDiscoveryCapability,
  type ServiceDiscoveryItem,
} from "../../features/service-discovery/wiring";

const serviceSchema = z.object({
  id: z.union([z.number().int().nonnegative(), z.string().min(1)]),
  tenCongViec: z.string().trim().min(1),
  danhGia: z.number().int().nonnegative().nullable().optional(),
  giaTien: z.number().finite().nonnegative(),
  hinhAnh: z.string().nullable().optional(),
  moTa: z.string().default(""),
  saoCongViec: z.number().finite().min(0).max(5).nullable().optional(),
});

const detailedServiceSchema = z.object({
  congViec: serviceSchema,
  tenNguoiTao: z.string().trim().nullable().optional(),
  avatar: z.string().nullable().optional(),
});

const detailedCollectionSchema = z.object({
  content: z.array(detailedServiceSchema),
});

const serviceCollectionSchema = z.object({ content: z.array(serviceSchema) });

function mapDetailedService(
  value: z.infer<typeof detailedServiceSchema>,
): ServiceDiscoveryItem {
  return {
    id: String(value.congViec.id),
    title: value.congViec.tenCongViec,
    description: value.congViec.moTa,
    price: value.congViec.giaTien,
    imageUrl: value.congViec.hinhAnh?.trim() || null,
    rating: value.congViec.saoCongViec ?? null,
    commentCount: value.congViec.danhGia ?? null,
    sellerName: value.tenNguoiTao?.trim() || null,
    sellerAvatarUrl: value.avatar?.trim() || null,
  };
}

function mapService(value: z.infer<typeof serviceSchema>): ServiceDiscoveryItem {
  return {
    id: String(value.id),
    title: value.tenCongViec,
    description: value.moTa,
    price: value.giaTien,
    imageUrl: value.hinhAnh?.trim() || null,
    rating: value.saoCongViec ?? null,
    commentCount: value.danhGia ?? 0,
    sellerName: null,
    sellerAvatarUrl: null,
  };
}

function normalizeFailure(error: unknown, signal: AbortSignal) {
  if (error instanceof ServiceDiscoveryFailure) return error;
  if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
    return new ServiceDiscoveryFailure("cancelled");
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return new ServiceDiscoveryFailure("offline");
  }
  if (error instanceof TypeError) return new ServiceDiscoveryFailure("network");
  return new ServiceDiscoveryFailure("unknown");
}

export function createCybersoftServiceDiscoveryCapability(config: {
  apiBaseUrl: string;
  cybersoftToken: string;
}): ServiceDiscoveryCapability {
  async function request(path: string, signal: AbortSignal, detailed: boolean) {
    try {
      const response = await fetch(config.apiBaseUrl + path, {
        signal,
        headers: { tokenCybersoft: config.cybersoftToken },
      });
      if (!response.ok) {
        throw new ServiceDiscoveryFailure(response.status >= 500 ? "server" : "unknown");
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new ServiceDiscoveryFailure("malformed");
      }
      if (detailed) {
        const parsed = detailedCollectionSchema.safeParse(payload);
        if (!parsed.success) throw new ServiceDiscoveryFailure("malformed");
        return parsed.data.content.map(mapDetailedService);
      }
      const parsed = serviceCollectionSchema.safeParse(payload);
      if (!parsed.success) throw new ServiceDiscoveryFailure("malformed");
      return parsed.data.content.map(mapService);
    } catch (error) {
      throw normalizeFailure(error, signal);
    }
  }

  return {
    listServices: (signal) => request("/cong-viec", signal, false),
    searchServices: (search, signal) =>
      request("/cong-viec/lay-danh-sach-cong-viec-theo-ten/" + encodeURIComponent(search), signal, true),
    listServicesBySubcategory: (subcategoryId, signal) =>
      request("/cong-viec/lay-cong-viec-theo-chi-tiet-loai/" + encodeURIComponent(subcategoryId), signal, true),
  };
}
