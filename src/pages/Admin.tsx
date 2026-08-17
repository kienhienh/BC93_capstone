import { useEffect, useRef } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import {
  AdminUserCreateRoute,
  AdminUserDetailRoute,
  AdminUserEditRoute,
  AdminUserListRoute,
} from "../features/admin-user-management/public";
import {
  AdminServiceCreateRoute,
  AdminServiceDetailRoute,
  AdminServiceEditRoute,
  AdminServiceListRoute,
} from "../features/admin-service-management/public";
import {
  AdminCategoryCreateRoute,
  AdminCategoryDetailRoute,
  AdminCategoryEditRoute,
  AdminCategoryListRoute,
} from "../features/admin-category-management/public";
import {
  AdminGroupCreateRoute,
  AdminGroupEditRoute,
  AdminSubcategoryCreateRoute,
  AdminSubcategoryDetailRoute,
  AdminSubcategoryEditRoute,
  AdminSubcategoryListRoute,
} from "../features/admin-subcategory-management/public";

type AdminDestination = {
  label: string;
  description: string;
  shortLabel: string;
  to?: string;
};

const destinations: AdminDestination[] = [
  {
    label: "Users",
    shortLabel: "US",
    description: "Manage marketplace accounts, profile data, and roles.",
    to: "/admin/users",
  },
  {
    label: "Services",
    shortLabel: "SV",
    description: "Review service metadata, sellers, pricing, and media.",
    to: "/admin/services",
  },
  {
    label: "Service Categories",
    shortLabel: "CA",
    description: "Organize top-level marketplace service categories.",
    to: "/admin/categories",
  },
  {
    label: "Service Subcategories",
    shortLabel: "SC",
    description: "Maintain groups and selectable taxonomy leaves.",
    to: "/admin/subcategories",
  },
  {
    label: "Comments",
    shortLabel: "CM",
    description: "Moderate ratings and marketplace comments.",
  },
  {
    label: "Hired Services",
    shortLabel: "HS",
    description: "Inspect and manage service engagements.",
  },
];

function AdminDashboard() {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = "Administrator | Fiverr Clone";
    heading.current?.focus();
  }, []);

  return (
    <main id="main-content" className="admin-dashboard">
      <header className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">Control center</span>
          <h1 ref={heading} tabIndex={-1}>Administrator Dashboard</h1>
          <p>Manage the marketplace from one focused workspace.</p>
        </div>
        <div className="admin-status-chip" role="status">
          <span aria-hidden="true" />
          Admin access active
        </div>
      </header>

      <section className="admin-welcome-card" aria-labelledby="admin-welcome-title">
        <div>
          <span className="admin-eyebrow">Marketplace administration</span>
          <h2 id="admin-welcome-title">Everything you manage, in one place.</h2>
          <p>
            Open a delivered management area below. Future destinations stay visible so
            the administration structure remains clear as the next issues are implemented.
          </p>
        </div>
        <Link to="/admin/users" className="admin-primary-action">
          Open User Management <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="admin-destinations" aria-labelledby="management-areas-title">
        <div className="admin-section-heading">
          <div>
            <span className="admin-eyebrow">Management areas</span>
            <h2 id="management-areas-title">Administration</h2>
          </div>
          <span className="admin-section-note">6 destinations</span>
        </div>

        <div className="admin-destination-grid">
          {destinations.map((destination) => {
            const content = (
              <>
                <span className="admin-destination-icon" aria-hidden="true">
                  {destination.shortLabel}
                </span>
                <span className="admin-destination-copy">
                  <strong>{destination.label}</strong>
                  <span>{destination.description}</span>
                </span>
                <span className={`admin-destination-state${destination.to ? " is-ready" : ""}`}>
                  {destination.to ? "Open" : "Planned"}
                </span>
              </>
            );

            return destination.to ? (
              <Link key={destination.label} to={destination.to} className="admin-destination-card is-ready">
                {content}
              </Link>
            ) : (
              <div key={destination.label} className="admin-destination-card is-planned" aria-disabled="true">
                {content}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default function Admin() {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Administrator navigation">
        <div className="admin-sidebar-brand">
          <Link to="/admin" aria-label="Administrator dashboard">
            <span className="admin-brand-mark" aria-hidden="true">A</span>
            <span>
              <strong>Admin</strong>
              <small>Marketplace console</small>
            </span>
          </Link>
        </div>

        <nav className="admin-navigation" aria-label="Management">
          <span className="admin-nav-label">Workspace</span>
          <NavLink
            to="/admin"
            end
            className={({ isActive }) => `admin-nav-link${isActive ? " is-active" : ""}`}
          >
            <span className="admin-nav-icon" aria-hidden="true">⌂</span>
            <span>Overview</span>
          </NavLink>

          <span className="admin-nav-label admin-nav-label-spaced">Management</span>
          {destinations.map((destination) => destination.to ? (
            <NavLink
              key={destination.label}
              to={destination.to}
              className={({ isActive }) => `admin-nav-link${isActive ? " is-active" : ""}`}
            >
              <span className="admin-nav-icon admin-nav-letter" aria-hidden="true">{destination.shortLabel}</span>
              <span>{destination.label}</span>
            </NavLink>
          ) : (
            <span key={destination.label} className="admin-nav-link is-disabled" aria-disabled="true">
              <span className="admin-nav-icon admin-nav-letter" aria-hidden="true">{destination.shortLabel}</span>
              <span>{destination.label}</span>
              <small>Soon</small>
            </span>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <span className="admin-footer-dot" aria-hidden="true" />
          <span>
            <strong>Administrator</strong>
            <small>Protected workspace</small>
          </span>
        </div>
      </aside>

      <section className="admin-workspace">
        <div className="admin-mobile-bar">
          <Link to="/admin" className="admin-mobile-brand">Admin Console</Link>
          <nav aria-label="Administrator mobile navigation">
            <NavLink to="/admin" end>Overview</NavLink>
            {destinations.map((destination) => destination.to ? (
              <NavLink key={destination.label} to={destination.to}>{destination.label}</NavLink>
            ) : (
              <span key={destination.label} aria-disabled="true">{destination.label}</span>
            ))}
          </nav>
        </div>

        <div className="admin-content">
          <Routes>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUserListRoute />} />
            <Route path="users/new" element={<AdminUserCreateRoute />} />
            <Route path="users/:userId/edit" element={<AdminUserEditRoute />} />
            <Route path="users/:userId" element={<AdminUserDetailRoute />} />
            <Route path="services" element={<AdminServiceListRoute />} />
            <Route path="services/new" element={<AdminServiceCreateRoute />} />
            <Route path="services/:serviceId/edit" element={<AdminServiceEditRoute />} />
            <Route path="services/:serviceId" element={<AdminServiceDetailRoute />} />
            <Route path="categories" element={<AdminCategoryListRoute />} />
            <Route path="categories/new" element={<AdminCategoryCreateRoute />} />
            <Route path="categories/:categoryId/edit" element={<AdminCategoryEditRoute />} />
            <Route path="categories/:categoryId" element={<AdminCategoryDetailRoute />} />
            <Route path="subcategories" element={<AdminSubcategoryListRoute />} />
            <Route path="subcategories/new" element={<AdminSubcategoryCreateRoute />} />
            <Route path="subcategories/groups/:categoryId/new" element={<AdminGroupCreateRoute />} />
            <Route path="subcategories/groups/:categoryId/:groupId/edit" element={<AdminGroupEditRoute />} />
            <Route path="subcategories/:subcategoryId/edit" element={<AdminSubcategoryEditRoute />} />
            <Route path="subcategories/:subcategoryId" element={<AdminSubcategoryDetailRoute />} />
          </Routes>
        </div>
      </section>
    </div>
  );
}
