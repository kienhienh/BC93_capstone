import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminUserManagementCapability } from "./context";
import type {
  AdminUser,
  AdminUserListParams,
  CreateAdministratorInput,
  UpdateUserInput,
} from "./capability";

export function useAdminUserList(params: AdminUserListParams, sessionToken: string) {
  const capability = useAdminUserManagementCapability();
  return useQuery({
    queryKey: ["admin-users", params.pageIndex, params.pageSize, params.keyword],
    queryFn: ({ signal }) => capability.listUsers(params, sessionToken, signal),
  });
}

export function useAdminUserDetail(userId: string, sessionToken: string, enabled = true) {
  const capability = useAdminUserManagementCapability();
  return useQuery({
    queryKey: ["admin-user", userId],
    queryFn: ({ signal }) => capability.getUserById(userId, sessionToken, signal),
    enabled,
  });
}

export function useCreateAdminUser(sessionToken: string) {
  const capability = useAdminUserManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAdministratorInput) => capability.createAdministrator(input, sessionToken),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); },
  });
}

export function useUpdateAdminUser(sessionToken: string) {
  const capability = useAdminUserManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) => capability.updateUser(id, input, sessionToken),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.setQueryData(["admin-user", data.id], data);
    },
  });
}

export function useDeleteAdminUser(sessionToken: string) {
  const capability = useAdminUserManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => capability.deleteUser(id, sessionToken),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.removeQueries({ queryKey: ["admin-user", variables.id] });
    },
  });
}

export function useAdminUserSafeguardEvidence(sessionToken: string) {
  const capability = useAdminUserManagementCapability();

  const refetchTarget = (id: string) => capability.getUserById(id, sessionToken);

  const listAllUsers = (): Promise<readonly AdminUser[]> =>
    capability.listAllUsers(sessionToken);

  const searchUsersByName = (name: string): Promise<readonly AdminUser[]> =>
    capability.searchUsersByName(name, sessionToken);

  return { refetchTarget, listAllUsers, searchUsersByName };
}
