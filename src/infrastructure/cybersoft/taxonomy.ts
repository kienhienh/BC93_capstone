import { z } from "zod";
import {
  TaxonomyFailure,
  type ServiceCategory,
  type TaxonomyCapability,
} from "../../features/taxonomy/wiring";

const subcategorySchema = z.object({
  id: z.union([z.number().int().nonnegative(), z.string().min(1)]),
  tenChiTiet: z.string().trim().min(1),
});

const groupSchema = z.object({
  id: z.union([z.number().int().nonnegative(), z.string().min(1)]),
  tenNhom: z.string().trim().min(1),
  hinhAnh: z.string().nullable().optional(),
  dsChiTietLoai: z.array(subcategorySchema),
});

const envelopeSchema = z.object({
  content: z.array(
    z.object({
      id: z.union([z.number().int().nonnegative(), z.string().min(1)]),
      tenLoaiCongViec: z.string().trim().min(1),
      dsNhomChiTietLoai: z.array(groupSchema),
    }),
  ),
});

export function createCybersoftTaxonomyCapability(config: {
  apiBaseUrl: string;
  cybersoftToken: string;
}): TaxonomyCapability {
  return {
    async listCategories(signal) {
      try {
        const response = await fetch(
          `${config.apiBaseUrl}/cong-viec/lay-menu-loai-cong-viec`,
          {
            signal,
            headers: { tokenCybersoft: config.cybersoftToken },
          },
        );
        if (!response.ok) {
          throw new TaxonomyFailure(response.status >= 500 ? "server" : "unknown");
        }
        const parsed = envelopeSchema.safeParse(await response.json());
        if (!parsed.success) throw new TaxonomyFailure("malformed");
        return parsed.data.content.map(mapCategory);
      } catch (error) {
        if (signal.aborted) throw new TaxonomyFailure("cancelled");
        if (error instanceof TaxonomyFailure) throw error;
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          throw new TaxonomyFailure("offline");
        }
        if (error instanceof TypeError) throw new TaxonomyFailure("network");
        if (error instanceof SyntaxError) throw new TaxonomyFailure("malformed");
        throw new TaxonomyFailure("unknown");
      }
    },
  };
}

function mapCategory(
  category: z.infer<typeof envelopeSchema>["content"][number],
): ServiceCategory {
  return {
    id: String(category.id),
    name: category.tenLoaiCongViec,
    groups: category.dsNhomChiTietLoai.map((group) => ({
      id: String(group.id),
      name: group.tenNhom,
      imageUrl: group.hinhAnh?.trim() || null,
      subcategories: group.dsChiTietLoai.map((subcategory) => ({
        id: String(subcategory.id),
        name: subcategory.tenChiTiet,
      })),
    })),
  };
}
