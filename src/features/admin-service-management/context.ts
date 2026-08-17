import { createContext, useContext } from "react";
import type { AdminServiceManagementCapability } from "./capability";

export const AdminServiceManagementContext = createContext<AdminServiceManagementCapability | null>(null);

export function useAdminServiceManagementCapability() {
  const capability = useContext(AdminServiceManagementContext);
  if (!capability) throw new Error("Admin Service Management capability is unavailable.");
  return capability;
}
