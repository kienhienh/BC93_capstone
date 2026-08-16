import { createContext, useContext } from "react";
import type { AdminUserManagementCapability } from "./capability";

export const AdminUserManagementContext = createContext<AdminUserManagementCapability | null>(null);

export function useAdminUserManagementCapability() {
  const capability = useContext(AdminUserManagementContext);
  if (!capability) throw new Error("Admin User Management capability is unavailable.");
  return capability;
}
