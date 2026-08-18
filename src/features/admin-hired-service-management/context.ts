import { createContext, useContext } from "react";
import type { AdminHiredServiceManagementCapability } from "./capability";

export const AdminHiredServiceManagementContext = createContext<AdminHiredServiceManagementCapability | null>(null);

export function useAdminHiredServiceManagementCapability() {
  const capability = useContext(AdminHiredServiceManagementContext);
  if (!capability) throw new Error("Admin Hired Service Management capability is unavailable.");
  return capability;
}
