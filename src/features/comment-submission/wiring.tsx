import type { ReactNode } from "react";
import type { CommentSubmissionCapability } from "./capability";
import { CommentSubmissionContext } from "./context";

export type { CommentSubmissionCapability } from "./capability";

export function CommentSubmissionProvider({
  capability,
  children,
}: {
  capability: CommentSubmissionCapability;
  children: ReactNode;
}) {
  return (
    <CommentSubmissionContext.Provider value={capability}>
      {children}
    </CommentSubmissionContext.Provider>
  );
}
