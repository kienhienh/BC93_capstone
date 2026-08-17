import type { ReactNode } from "react";
import type { AdminCategoryManagementCapability } from "./capability";
import { AdminCategoryManagementContext } from "./context";

export function AdminCategoryManagementProvider({ capability, children }: {
  capability: AdminCategoryManagementCapability;
  children: ReactNode;
}) {
  return <AdminCategoryManagementContext.Provider value={capability}>{children}</AdminCategoryManagementContext.Provider>;
}
