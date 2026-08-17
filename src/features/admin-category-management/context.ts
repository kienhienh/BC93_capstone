import { createContext, useContext } from "react";
import type { AdminCategoryManagementCapability } from "./capability";

export const AdminCategoryManagementContext = createContext<AdminCategoryManagementCapability | null>(null);

export function useAdminCategoryManagementCapability() {
  const capability = useContext(AdminCategoryManagementContext);
  if (!capability) throw new Error("Admin Service Category Management capability is unavailable.");
  return capability;
}
