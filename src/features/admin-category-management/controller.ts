import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminCategoryListParams, CategoryNameInput } from "./capability";
import { useAdminCategoryManagementCapability } from "./context";

export function useAdminCategoryList(params: AdminCategoryListParams, sessionToken: string) {
  const capability = useAdminCategoryManagementCapability();
  return useQuery({
    queryKey: ["admin-categories", params.pageIndex, params.pageSize, params.keyword],
    queryFn: ({ signal }) => capability.listCategories(params, sessionToken, signal),
  });
}

export function useAdminCategoryDetail(categoryId: string, sessionToken: string, enabled = true) {
  const capability = useAdminCategoryManagementCapability();
  return useQuery({
    queryKey: ["admin-category", categoryId],
    queryFn: ({ signal }) => capability.getCategoryById(categoryId, sessionToken, signal),
    enabled,
  });
}

export function useAdminCategoryHierarchy(categoryId: string, sessionToken: string, enabled = true) {
  const capability = useAdminCategoryManagementCapability();
  return useQuery({
    queryKey: ["admin-category-hierarchy", categoryId],
    queryFn: ({ signal }) => capability.getCategoryHierarchy(categoryId, sessionToken, signal),
    enabled,
  });
}

export function useCreateAdminCategory(sessionToken: string) {
  const capability = useAdminCategoryManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CategoryNameInput) => capability.createCategory(input, sessionToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
}

export function useUpdateAdminCategory(sessionToken: string) {
  const capability = useAdminCategoryManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CategoryNameInput }) =>
      capability.updateCategory(id, input, sessionToken),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.setQueryData(["admin-category", data.id], data);
    },
  });
}

export function useDeleteAdminCategory(sessionToken: string) {
  const capability = useAdminCategoryManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => capability.deleteCategory(id, sessionToken),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.removeQueries({ queryKey: ["admin-category", variables.id] });
      queryClient.removeQueries({ queryKey: ["admin-category-hierarchy", variables.id] });
    },
  });
}

export function useAdminCategorySafeguardEvidence(sessionToken: string) {
  const capability = useAdminCategoryManagementCapability();
  return {
    refetchTarget: (id: string) => capability.getCategoryById(id, sessionToken),
    refetchHierarchy: (id: string) => capability.getCategoryHierarchy(id, sessionToken),
    listAllCategories: () => capability.listAllCategories(sessionToken),
  };
}
