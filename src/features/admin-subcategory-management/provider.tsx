import type { ReactNode } from "react";
import type { AdminSubcategoryManagementCapability } from "./capability";
import { AdminSubcategoryManagementContext } from "./context";

export function AdminSubcategoryManagementProvider({ capability, children }: {
  capability: AdminSubcategoryManagementCapability;
  children: ReactNode;
}) {
  return <AdminSubcategoryManagementContext.Provider value={capability}>{children}</AdminSubcategoryManagementContext.Provider>;
}
