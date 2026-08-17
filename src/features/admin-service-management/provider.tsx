import type { ReactNode } from "react";
import type { AdminServiceManagementCapability } from "./capability";
import { AdminServiceManagementContext } from "./context";

export function AdminServiceManagementProvider({
  capability,
  children,
}: {
  capability: AdminServiceManagementCapability;
  children: ReactNode;
}) {
  return (
    <AdminServiceManagementContext.Provider value={capability}>
      {children}
    </AdminServiceManagementContext.Provider>
  );
}
