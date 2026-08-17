import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminServiceManagementCapability } from "./context";
import type {
  AdminService,
  AdminServiceListParams,
  CreateServiceInput,
  UpdateServiceInput,
} from "./capability";

export function useAdminServiceList(params: AdminServiceListParams, sessionToken: string) {
  const capability = useAdminServiceManagementCapability();
  return useQuery({
    queryKey: ["admin-services", params.pageIndex, params.pageSize, params.keyword],
    queryFn: ({ signal }) => capability.listServices(params, sessionToken, signal),
  });
}

export function useAdminServiceDetail(serviceId: string, sessionToken: string, enabled = true) {
  const capability = useAdminServiceManagementCapability();
  return useQuery({
    queryKey: ["admin-service", serviceId],
    queryFn: ({ signal }) => capability.getServiceById(serviceId, sessionToken, signal),
    enabled,
  });
}

export function useCreateAdminService(sessionToken: string) {
  const capability = useAdminServiceManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateServiceInput) => capability.createService(input, sessionToken),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-services"] }); },
  });
}

export function useUpdateAdminService(sessionToken: string) {
  const capability = useAdminServiceManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateServiceInput }) =>
      capability.updateService(id, input, sessionToken),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      queryClient.setQueryData(["admin-service", data.id], data);
    },
  });
}

export function useDeleteAdminService(sessionToken: string) {
  const capability = useAdminServiceManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => capability.deleteService(id, sessionToken),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      queryClient.removeQueries({ queryKey: ["admin-service", variables.id] });
    },
  });
}

export function useUploadServiceImage(sessionToken: string) {
  const capability = useAdminServiceManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      capability.uploadServiceImage(id, file, sessionToken),
    onSuccess: (data) => {
      queryClient.setQueryData(["admin-service", data.id], data);
    },
  });
}

export function useAdminServiceSafeguardEvidence(sessionToken: string) {
  const capability = useAdminServiceManagementCapability();

  const refetchTarget = (id: string) => capability.getServiceById(id, sessionToken);

  const listAllServices = (): Promise<readonly AdminService[]> =>
    capability.listAllServices(sessionToken);

  const hasHiresForService = (serviceId: string): Promise<boolean> =>
    capability.hasHiresForService(serviceId, sessionToken);

  return { refetchTarget, listAllServices, hasHiresForService };
}
