import type { ReactNode } from "react";
import type { AdminHiredServiceManagementCapability } from "./capability";
import { AdminHiredServiceManagementContext } from "./context";

export function AdminHiredServiceManagementProvider({ capability, children }: {
  capability: AdminHiredServiceManagementCapability;
  children: ReactNode;
}) {
  return <AdminHiredServiceManagementContext.Provider value={capability}>{children}</AdminHiredServiceManagementContext.Provider>;
}
