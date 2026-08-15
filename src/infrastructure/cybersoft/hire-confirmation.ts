import { z } from "zod";
import {
  HireFailure,
  type CreateHireInput,
  type HireConfirmationCapability,
  type HiredService,
} from "../../features/hire-confirmation/capability";
import { createCybersoftServiceDetailCapability } from "./service-detail";
import { ServiceDetailFailure } from "../../features/service-detail/capability";

const idSchema = z.union([z.number().int().nonnegative(), z.string().trim().min(1)]);
const acceptedSchema = z.object({ content: z.object({ id: idSchema }) });
const hiredServiceSchema = z.object({
  id: idSchema,
  maCongViec: idSchema,
  maNguoiThue: idSchema,
  ngayThue: z.string().trim().min(1),
  hoanThanh: z.boolean(),
  congViec: z.object({
    tenCongViec: z.string().trim().min(1),
    giaTien: z.number().finite().nonnegative(),
  }).optional(),
  nguoiBan: z.object({
    id: idSchema,
    name: z.string().trim().min(1),
  }).optional(),
});
const hiredServicesSchema = z.object({ content: z.array(hiredServiceSchema) });

function numericId(value: string, field: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${field} is invalid.`);
  return parsed;
}

function hireBody(input: CreateHireInput) {
  return {
    id: 0,
    maCongViec: numericId(input.serviceId, "Service ID"),
    maNguoiThue: numericId(input.userId, "User ID"),
    ngayThue: input.hiredAt,
    hoanThanh: false,
  };
}

async function safeJson(response: Response) {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

function responseFailure(response: Response) {
  if (response.status === 401) return new HireFailure("unauthorized");
  if (response.status === 403) return new HireFailure("forbidden");
  return new HireFailure(response.status >= 500 ? "server" : "unknown");
}

function transportFailure(error: unknown, signal?: AbortSignal) {
  if (error instanceof HireFailure) return error;
  if (signal?.aborted) return new HireFailure("cancelled");
  if (typeof navigator !== "undefined" && !navigator.onLine) return new HireFailure("offline");
  if (error instanceof TypeError) return new HireFailure("network");
  return new HireFailure("unknown");
}

export function createCybersoftHireConfirmationCapability(config: {
  apiBaseUrl: string;
  cybersoftToken: string;
}): HireConfirmationCapability {
  const serviceDetail = createCybersoftServiceDetailCapability(config);
  const cybersoftHeaders = { tokenCybersoft: config.cybersoftToken };
  return {
    async getService(serviceId, signal) {
      try {
        const service = await serviceDetail.getService(serviceId, signal);
        return {
          id: service.id,
          title: service.title,
          price: service.price,
          seller: service.seller?.id && service.seller.name
            ? { id: service.seller.id, name: service.seller.name }
            : null,
        };
      } catch (error) {
        if (error instanceof ServiceDetailFailure) throw new HireFailure(error.kind);
        throw transportFailure(error, signal);
      }
    },
    async createHire(input, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/thue-cong-viec`, {
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
            token: input.sessionToken,
            ...cybersoftHeaders,
          },
          body: JSON.stringify(hireBody(input)),
        });
        if (!response.ok) throw responseFailure(response);
        const parsed = acceptedSchema.safeParse(await safeJson(response));
        return parsed.success
          ? { kind: "accepted" as const, hireId: String(parsed.data.content.id) }
          : { kind: "unknown" as const };
      } catch (error) {
        if (error instanceof HireFailure) throw error;
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          throw new HireFailure("offline");
        }
        if (error instanceof TypeError) return { kind: "unknown" };
        throw transportFailure(error, signal);
      }
    },
    async listHiredServices(sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/thue-cong-viec/lay-danh-sach-da-thue`, {
          signal,
          headers: { token: sessionToken, ...cybersoftHeaders },
        });
        if (!response.ok) throw responseFailure(response);
        const parsed = hiredServicesSchema.safeParse(await safeJson(response));
        if (!parsed.success) throw new HireFailure("malformed");
        return parsed.data.content.map((item): HiredService => ({
          id: String(item.id),
          serviceId: String(item.maCongViec),
          userId: String(item.maNguoiThue),
          hiredAt: item.ngayThue,
          completed: item.hoanThanh,
          service: item.congViec
            ? { title: item.congViec.tenCongViec, price: item.congViec.giaTien }
            : null,
          seller: item.nguoiBan
            ? { id: String(item.nguoiBan.id), name: item.nguoiBan.name }
            : null,
        }));
      } catch (error) {
        throw transportFailure(error, signal);
      }
    },
    async getHiredService(hireId, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/thue-cong-viec/lay-danh-sach-da-thue`, {
          signal,
          headers: { token: sessionToken, ...cybersoftHeaders },
        });
        if (!response.ok) throw responseFailure(response);
        const parsed = hiredServicesSchema.safeParse(await safeJson(response));
        if (!parsed.success) throw new HireFailure("malformed");
        const item = parsed.data.content.find((x) => String(x.id) === hireId);
        if (!item) throw new HireFailure("not_found");
        return {
          id: String(item.id),
          serviceId: String(item.maCongViec),
          userId: String(item.maNguoiThue),
          hiredAt: item.ngayThue,
          completed: item.hoanThanh,
          service: item.congViec
            ? { title: item.congViec.tenCongViec, price: item.congViec.giaTien }
            : null,
          seller: item.nguoiBan
            ? { id: String(item.nguoiBan.id), name: item.nguoiBan.name }
            : null,
        };
      } catch (error) {
        throw transportFailure(error, signal);
      }
    },
    async completeHire(hireId, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/thue-cong-viec/${hireId}`, {
          method: "PUT",
          signal,
          headers: {
            "Content-Type": "application/json",
            token: sessionToken,
            ...cybersoftHeaders,
          },
          body: JSON.stringify({ hoanThanh: true }),
        });
        if (!response.ok) throw responseFailure(response);
        return { kind: "accepted" as const };
      } catch (error) {
        if (error instanceof HireFailure) throw error;
        throw transportFailure(error, signal);
      }
    },
    async cancelHire(hireId, sessionToken, signal) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/thue-cong-viec/${hireId}`, {
          method: "DELETE",
          signal,
          headers: {
            token: sessionToken,
            ...cybersoftHeaders,
          },
        });
        if (!response.ok) throw responseFailure(response);
        return { kind: "accepted" as const };
      } catch (error) {
        if (error instanceof HireFailure) throw error;
        throw transportFailure(error, signal);
      }
    },
  };
}
