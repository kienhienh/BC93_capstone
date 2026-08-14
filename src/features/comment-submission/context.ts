import { createContext, useContext } from "react";
import type { CommentSubmissionCapability } from "./capability";

export const CommentSubmissionContext = createContext<CommentSubmissionCapability | null>(null);

export function useCommentSubmissionCapability() {
  const capability = useContext(CommentSubmissionContext);
  if (!capability) throw new Error("Comment Submission capability is unavailable.");
  return capability;
}
