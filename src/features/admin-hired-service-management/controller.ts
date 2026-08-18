import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminHiredServiceManagementCapability } from "./context";

export function useAdminAllHiredServices(sessionToken: string) {
  const capability = useAdminHiredServiceManagementCapability();
  return useQuery({
    queryKey: ["admin-hired-services"],
    queryFn: ({ signal }) => capability.listAllHiredServices(sessionToken, signal),
  });
}

export function useAdminHiredServiceServices(sessionToken: string) {
  const capability = useAdminHiredServiceManagementCapability();
  return useQuery({
    queryKey: ["admin-hired-service-services"],
    queryFn: ({ signal }) => capability.listAllServices(sessionToken, signal),
  });
}

export function useAdminHiredServiceUsers(sessionToken: string) {
  const capability = useAdminHiredServiceManagementCapability();
  return useQuery({
    queryKey: ["admin-hired-service-users"],
    queryFn: ({ signal }) => capability.listAllUsers(sessionToken, signal),
  });
}

export function useCompleteAdminHiredService(sessionToken: string) {
  const capability = useAdminHiredServiceManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => capability.completeHiredService(id, sessionToken),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-hired-services"] }),
  });
}

export function useCancelAdminHiredService(sessionToken: string) {
  const capability = useAdminHiredServiceManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => capability.cancelHiredService(id, sessionToken),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-hired-services"] }),
  });
}

export function useAdminHiredServiceSafeguardEvidence(sessionToken: string) {
  const capability = useAdminHiredServiceManagementCapability();
  return {
    refetchEvidence: (id: string) => capability.refetchHiredServiceEvidence(id, sessionToken),
  };
}
