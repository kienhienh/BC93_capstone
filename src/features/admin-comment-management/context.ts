import { createContext, useContext } from "react";
import type { AdminCommentManagementCapability } from "./capability";

export const AdminCommentManagementContext = createContext<AdminCommentManagementCapability | null>(null);

export function useAdminCommentManagementCapability() {
  const capability = useContext(AdminCommentManagementContext);
  if (!capability) throw new Error("Admin Comment Management capability is unavailable.");
  return capability;
}
