import { useMutation } from "@tanstack/react-query";
import { useCommentSubmissionCapability } from "./context";

export function useSubmitComment() {
  const capability = useCommentSubmissionCapability();
  return useMutation({
    mutationFn: ({ signal, ...input }: Parameters<typeof capability.submitComment>[0] & { signal?: AbortSignal }) =>
      capability.submitComment(input, signal),
    retry: false,
  });
}
