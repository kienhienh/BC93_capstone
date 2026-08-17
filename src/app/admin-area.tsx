import { useMemo } from "react";
import { AdminUserManagementProvider } from "../features/admin-user-management/wiring";
import { createCybersoftAdminUserManagementCapability } from "../infrastructure/cybersoft/admin-user-management";
import { AdminServiceManagementProvider } from "../features/admin-service-management/wiring";
import { createCybersoftAdminServiceManagementCapability } from "../infrastructure/cybersoft/admin-service-management";
import { AdminCategoryManagementProvider } from "../features/admin-category-management/wiring";
import { createCybersoftAdminCategoryManagementCapability } from "../infrastructure/cybersoft/admin-category-management";
import { AdminSubcategoryManagementProvider } from "../features/admin-subcategory-management/wiring";
import { createCybersoftAdminSubcategoryManagementCapability } from "../infrastructure/cybersoft/admin-subcategory-management";
import { AdminCommentManagementProvider } from "../features/admin-comment-management/wiring";
import { createCybersoftAdminCommentManagementCapability } from "../infrastructure/cybersoft/admin-comment-management";
import Admin from "../pages/Admin";
import type { RuntimeConfig } from "./runtime-config";

/**
 * Lazy Administrator composition boundary.
 *
 * App.tsx imports this module through React.lazy only after AdminRoute has
 * confirmed an exact ADMIN session. Keeping the provider, Admin routes and
 * Cybersoft Admin adapter behind this boundary prevents ordinary/unknown-role
 * sessions from loading Administrator feature code.
 */
export default function AdminArea({ config }: { config: RuntimeConfig }) {
  const { apiBaseUrl, cybersoftToken } = config;
  const capability = useMemo(
    () => createCybersoftAdminUserManagementCapability({ apiBaseUrl, cybersoftToken }),
    [apiBaseUrl, cybersoftToken],
  );
  const serviceCapability = useMemo(
    () => createCybersoftAdminServiceManagementCapability({ apiBaseUrl, cybersoftToken }),
    [apiBaseUrl, cybersoftToken],
  );
  const categoryCapability = useMemo(
    () => createCybersoftAdminCategoryManagementCapability({ apiBaseUrl, cybersoftToken }),
    [apiBaseUrl, cybersoftToken],
  );
  const subcategoryCapability = useMemo(
    () => createCybersoftAdminSubcategoryManagementCapability({ apiBaseUrl, cybersoftToken }),
    [apiBaseUrl, cybersoftToken],
  );
  const commentCapability = useMemo(
    () => createCybersoftAdminCommentManagementCapability({ apiBaseUrl, cybersoftToken }),
    [apiBaseUrl, cybersoftToken],
  );

  return (
    <AdminUserManagementProvider capability={capability}>
      <AdminServiceManagementProvider capability={serviceCapability}>
        <AdminCategoryManagementProvider capability={categoryCapability}>
          <AdminSubcategoryManagementProvider capability={subcategoryCapability}>
            <AdminCommentManagementProvider capability={commentCapability}>
              <Admin />
            </AdminCommentManagementProvider>
          </AdminSubcategoryManagementProvider>
        </AdminCategoryManagementProvider>
      </AdminServiceManagementProvider>
    </AdminUserManagementProvider>
  );
}
