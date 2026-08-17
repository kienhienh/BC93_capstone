import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateCommentInput, UpdateCommentInput } from "./capability";
import { useAdminCommentManagementCapability } from "./context";

export function useAdminAllComments(sessionToken: string) {
  const capability = useAdminCommentManagementCapability();
  return useQuery({
    queryKey: ["admin-comments"],
    queryFn: ({ signal }) => capability.listAllComments(sessionToken, signal),
  });
}

export function useAdminCommentServices(sessionToken: string) {
  const capability = useAdminCommentManagementCapability();
  return useQuery({
    queryKey: ["admin-comment-services"],
    queryFn: ({ signal }) => capability.listAllServices(sessionToken, signal),
  });
}

export function useAdminCommentAuthors(sessionToken: string) {
  const capability = useAdminCommentManagementCapability();
  return useQuery({
    queryKey: ["admin-comment-authors"],
    queryFn: ({ signal }) => capability.listAllAuthors(sessionToken, signal),
  });
}

export function useCreateAdminComment(sessionToken: string) {
  const capability = useAdminCommentManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommentInput) => capability.createComment(input, sessionToken),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-comments"] }),
  });
}

export function useUpdateAdminComment(sessionToken: string) {
  const capability = useAdminCommentManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCommentInput }) =>
      capability.updateComment(id, input, sessionToken),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-comments"] }),
  });
}

export function useDeleteAdminComment(sessionToken: string) {
  const capability = useAdminCommentManagementCapability();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => capability.deleteComment(id, sessionToken),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-comments"] }),
  });
}

export function useAdminCommentSafeguardEvidence(sessionToken: string) {
  const capability = useAdminCommentManagementCapability();
  return {
    refetchEvidence: (serviceId: string, commentId: string) =>
      capability.refetchCommentEvidence(serviceId, commentId, sessionToken),
    listAllServices: () => capability.listAllServices(sessionToken),
  };
}
