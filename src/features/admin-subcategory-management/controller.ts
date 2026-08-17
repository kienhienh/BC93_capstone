import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminSubcategoryListParams, GroupMembershipInput, SubcategoryNameInput } from "./capability";
import { useAdminSubcategoryManagementCapability } from "./context";
import { buildMembershipIndex } from "./subcategory-safeguards";

export function useAdminSubcategoryList(params: AdminSubcategoryListParams, sessionToken: string) {
  const capability = useAdminSubcategoryManagementCapability();
  return useQuery({
    queryKey: ["admin-subcategories", params.pageIndex, params.pageSize, params.keyword],
    queryFn: ({ signal }) => capability.listSubcategories(params, sessionToken, signal),
  });
}

export function useAdminSubcategoryDetail(subcategoryId: string, sessionToken: string, enabled = true) {
  const capability = useAdminSubcategoryManagementCapability();
  return useQuery({
    queryKey: ["admin-subcategory", subcategoryId],
    queryFn: ({ signal }) => capability.getSubcategoryById(subcategoryId, sessionToken, signal),
    enabled,
  });
}

export function useAdminCategoryHierarchy(categoryId: string, sessionToken: string, enabled = true) {
  const capability = useAdminSubcategoryManagementCapability();
  return useQuery({
    queryKey: ["admin-subcategory-category-hierarchy", categoryId],
    queryFn: ({ signal }) => capability.getCategoryHierarchy(categoryId, sessionToken, signal),
    enabled,
  });
}

export function useAdminTaxonomyCategories(sessionToken: string, enabled = true) {
  const capability = useAdminSubcategoryManagementCapability();
  return useQuery({
    queryKey: ["admin-subcategory-taxonomy-categories"],
    queryFn: ({ signal }) => capability.listAllCategories(sessionToken, signal),
    enabled,
  });
}

export function useAdminAllSubcategories(sessionToken: string, enabled = true) {
  const capability = useAdminSubcategoryManagementCapability();
  return useQuery({
    queryKey: ["admin-subcategory-all"],
    queryFn: ({ signal }) => capability.listAllSubcategories(sessionToken, signal),
    enabled,
  });
}

export function useAdminMembershipIndex(sessionToken: string, enabled = true) {
  const capability = useAdminSubcategoryManagementCapability();
  return useQuery({
    queryKey: ["admin-subcategory-membership-index"],
    queryFn: async ({ signal }) => {
      const categories = await capability.listAllCategories(sessionToken, signal);
      const hierarchies = await Promise.all(
        categories.map((category) => capability.getCategoryHierarchy(category.id, sessionToken, signal)),
      );
      return buildMembershipIndex(hierarchies);
    },
    enabled,
  });
}

export function useCreateAdminSubcategory(sessionToken: string) {
  const capability = useAdminSubcategoryManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubcategoryNameInput) => capability.createSubcategory(input, sessionToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-subcategories"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-subcategory-all"] });
    },
  });
}

export function useUpdateAdminSubcategory(sessionToken: string) {
  const capability = useAdminSubcategoryManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SubcategoryNameInput }) =>
      capability.updateSubcategory(id, input, sessionToken),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-subcategories"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-subcategory-all"] });
      queryClient.setQueryData(["admin-subcategory", data.id], data);
    },
  });
}

export function useDeleteAdminSubcategory(sessionToken: string) {
  const capability = useAdminSubcategoryManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => capability.deleteSubcategory(id, sessionToken),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-subcategories"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-subcategory-all"] });
      queryClient.removeQueries({ queryKey: ["admin-subcategory", variables.id] });
    },
  });
}

export function useCreateAdminGroup(sessionToken: string) {
  const capability = useAdminSubcategoryManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GroupMembershipInput) => capability.createGroup(input, sessionToken),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-subcategory-category-hierarchy", variables.categoryId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-subcategory-membership-index"] });
    },
  });
}

export function useUpdateAdminGroup(sessionToken: string) {
  const capability = useAdminSubcategoryManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, input }: { groupId: string; input: GroupMembershipInput }) =>
      capability.updateGroup(groupId, input, sessionToken),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-subcategory-category-hierarchy", variables.input.categoryId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-subcategory-membership-index"] });
    },
  });
}

export function useAdminSubcategorySafeguardEvidence(sessionToken: string) {
  const capability = useAdminSubcategoryManagementCapability();
  return {
    refetchTarget: (id: string) => capability.getSubcategoryById(id, sessionToken),
    listAllSubcategories: () => capability.listAllSubcategories(sessionToken),
    refetchCategoryHierarchy: (categoryId: string) => capability.getCategoryHierarchy(categoryId, sessionToken),
    refetchMembershipIndex: async () => {
      const categories = await capability.listAllCategories(sessionToken);
      const hierarchies = await Promise.all(categories.map((category) => capability.getCategoryHierarchy(category.id, sessionToken)));
      return buildMembershipIndex(hierarchies);
    },
  };
}
