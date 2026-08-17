import type { ReactNode } from "react";
import type { AdminCommentManagementCapability } from "./capability";
import { AdminCommentManagementContext } from "./context";

export function AdminCommentManagementProvider({ capability, children }: {
  capability: AdminCommentManagementCapability;
  children: ReactNode;
}) {
  return <AdminCommentManagementContext.Provider value={capability}>{children}</AdminCommentManagementContext.Provider>;
}
