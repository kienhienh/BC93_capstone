import { useQuery } from "@tanstack/react-query";
import { useTaxonomyCapability } from "./context";

export const taxonomyQueryKey = ["service-taxonomy"] as const;

export function useTaxonomy() {
  const capability = useTaxonomyCapability();
  return useQuery({
    queryKey: taxonomyQueryKey,
    queryFn: ({ signal }) => capability.listCategories(signal),
    staleTime: 60_000,
  });
}

export function useCategoryTaxonomy(categoryId: string) {
  const capability = useTaxonomyCapability();
  return useQuery({
    queryKey: ["service-category", categoryId],
    queryFn: ({ signal }) => capability.getCategory(categoryId, signal),
    staleTime: 60_000,
    refetchOnMount: "always",
  });
}
