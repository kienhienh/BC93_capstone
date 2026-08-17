import { createContext, useContext } from "react";
import type { AdminSubcategoryManagementCapability } from "./capability";

export const AdminSubcategoryManagementContext = createContext<AdminSubcategoryManagementCapability | null>(null);

export function useAdminSubcategoryManagementCapability() {
  const capability = useContext(AdminSubcategoryManagementContext);
  if (!capability) throw new Error("Admin Service Subcategory Management capability is unavailable.");
  return capability;
}
