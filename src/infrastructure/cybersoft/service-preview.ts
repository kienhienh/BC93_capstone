import { z } from "zod";
import {
  ServicePreviewFailure,
  type ServicePreview,
  type ServicePreviewCapability,
} from "../../features/service-preview/wiring";

const serviceDtoSchema = z.object({
  id: z.union([z.number().int().nonnegative(), z.string().min(1)]),
  tenCongViec: z.string().trim().min(1),
  moTa: z.string().default(""),
  giaTien: z.number().finite().nonnegative(),
  hinhAnh: z.string().nullable().optional(),
  saoCongViec: z.number().finite().min(0).max(5).nullable().optional(),
});

const serviceCollectionEnvelopeSchema = z.object({
  content: z.array(serviceDtoSchema),
});

function normalizeFailure(error: unknown): ServicePreviewFailure {
  if (error instanceof ServicePreviewFailure) {
    return error;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new ServicePreviewFailure("cancelled", "The Service request was cancelled.");
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return new ServicePreviewFailure("offline", "The browser is offline.");
  }

  if (error instanceof TypeError) {
    return new ServicePreviewFailure("network", "The Service request could not connect.");
  }

  return new ServicePreviewFailure("unknown", "The Service request failed.");
}

function mapService(dto: z.infer<typeof serviceDtoSchema>): ServicePreview {
  return {
    id: String(dto.id),
    title: dto.tenCongViec,
    description: dto.moTa,
    price: dto.giaTien,
    imageUrl: dto.hinhAnh?.trim() || null,
    rating: dto.saoCongViec ?? null,
  };
}

export function createCybersoftServicePreviewCapability(config: {
  apiBaseUrl: string;
  cybersoftToken: string;
}): ServicePreviewCapability {
  return {
    async listServices(signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/cong-viec`, {
          signal,
          headers: {
            tokenCybersoft: config.cybersoftToken,
          },
        });

        if (!response.ok) {
          throw new ServicePreviewFailure(
            response.status >= 500 ? "server" : "unknown",
            "The Service endpoint returned an unsuccessful response.",
          );
        }

        const payload: unknown = await response.json();
        const result = serviceCollectionEnvelopeSchema.safeParse(payload);

        if (!result.success) {
          throw new ServicePreviewFailure(
            "malformed",
            "The Service collection response was malformed.",
          );
        }

        return result.data.content.map(mapService);
      } catch (error) {
        if (signal.aborted) {
          throw new ServicePreviewFailure("cancelled", "The Service request was cancelled.");
        }
        throw normalizeFailure(error);
      }
    },
  };
}
