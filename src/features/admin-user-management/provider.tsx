import type { ReactNode } from "react";
import type { AdminUserManagementCapability } from "./capability";
import { AdminUserManagementContext } from "./context";

export function AdminUserManagementProvider({
  capability,
  children,
}: {
  capability: AdminUserManagementCapability;
  children: ReactNode;
}) {
  return (
    <AdminUserManagementContext.Provider value={capability}>
      {children}
    </AdminUserManagementContext.Provider>
  );
}
