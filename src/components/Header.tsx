import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../features/authentication/public";
import AccountMenu from "./AccountMenu";
import AdminAccountMenu from "./AdminAccountMenu";
import { useTaxonomy } from "../features/taxonomy/public";

type Viewport = "phone" | "tablet" | "desktop";

function getViewport(): Viewport {
  const width = document.documentElement.clientWidth || window.innerWidth;
  if (width < 600) return "phone";
  if (width < 1024) return "tablet";
  return "desktop";
}

function useViewport() {
  const [viewport, setViewport] = useState<Viewport>(getViewport);
  useEffect(() => {
    const update = () => setViewport(getViewport());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return viewport;
}

function Drawer({
  title,
  closeLabel,
  opener,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  opener: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = `drawer-${title.toLowerCase().replaceAll(" ", "-")}`;

  useEffect(() => {
    const background = document.getElementById("application-content");
    const openerElement = opener.current;
    background?.setAttribute("inert", "");
    closeRef.current?.focus();
    return () => {
      background?.removeAttribute("inert");
      openerElement?.focus();
    };
  }, [opener]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(
      drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled])',
      ) ?? [],
    );
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="drawer-backdrop">
      <div
        ref={drawerRef}
        className="marketplace-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <div className="drawer-heading">
          <h2 id={titleId}>{title}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={closeLabel}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function CategoryLinks({ onSelect }: { onSelect?: () => void }) {
  const taxonomy = useTaxonomy();
  if (taxonomy.isPending) return <p className="category-navigation-status" aria-live="polite">Loading Service Categories...</p>;
  if (taxonomy.isError) return <p className="category-navigation-status">Service Categories are unavailable.</p>;
  if (taxonomy.data.length === 0) return <p className="category-navigation-status">No Service Categories are available.</p>;
  return (
    <ul className="category-links">
      {taxonomy.data.map((category) => (
        <li key={category.id}>
          <Link to={`/categories/${category.id}`} onClick={onSelect}>
            {category.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Header() {
  const viewport = useViewport();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, logout } = useSession();
  const [drawer, setDrawer] = useState<"categories" | "menu" | "search" | null>(null);
  const categoryOpener = useRef<HTMLButtonElement>(null);
  const menuOpener = useRef<HTMLButtonElement>(null);
  const searchOpener = useRef<HTMLButtonElement>(null);
  const usesInitialHeader = ["/", "/login", "/register"].includes(location.pathname);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get("query")?.toString().trim().replace(/\s+/g, " ");
    navigate(query ? `/services?search=${encodeURIComponent(query)}` : "/services");
    setDrawer(null);
  };

  const signOut = () => {
    logout();
    navigate("/");
  };

  return (
    <header className={`marketplace-header${usesInitialHeader ? " marketplace-header-home" : ""}`}>
      <nav className="primary-navigation" aria-label="Primary navigation">
        <Link className="marketplace-brand" to="/" aria-label="Fiverr Marketplace home">
          fiverr
        </Link>

        {!usesInitialHeader && viewport !== "phone" ? (
          <form className="header-search" role="search" onSubmit={submitSearch}>
            <label className="visually-hidden" htmlFor="header-search">Search services</label>
            <input key={location.search} id="header-search" name="query" type="search" placeholder="What service are you looking for today?" defaultValue={new URLSearchParams(location.search).get("search") ?? ""} />
            <button type="submit" aria-label="Search"><i className="bi bi-search" aria-hidden="true" /></button>
          </form>
        ) : !usesInitialHeader ? (
          <button ref={searchOpener} type="button" onClick={() => setDrawer("search")}>
            Search services
          </button>
        ) : null}

        {!usesInitialHeader && viewport === "tablet" ? (
          <button ref={categoryOpener} type="button" onClick={() => setDrawer("categories")}>
            Browse categories
          </button>
        ) : null}

        {!usesInitialHeader && viewport === "desktop" ? (
          <div className="header-utilities" aria-label="Marketplace utilities">
            <Link className="business-link" to="/services">Fiverr Business</Link>
            <Link to="/services">Explore</Link>
          </div>
        ) : null}

        {viewport === "phone" ? (
          <button ref={menuOpener} type="button" onClick={() => setDrawer("menu")}>
            Open menu
          </button>
        ) : (
          <div className="account-links">
            {!session ? (
              <>
                <Link className="seller-link" to="/register">Become a Seller</Link>
                <Link aria-label="Login" to="/login">Sign In</Link>
                <Link className="join-link" aria-label="Register" to="/register">Join</Link>
              </>
            ) : session.user.role === "ADMIN" ? (
              <AdminAccountMenu />
            ) : (
              <AccountMenu />
            )}
          </div>
        )}
      </nav>

      {!usesInitialHeader && viewport === "desktop" ? (
        <nav className="category-navigation" aria-label="Service Categories">
          <CategoryLinks />
        </nav>
      ) : null}

      {drawer === "categories" ? (
        <Drawer
          title="Service Categories"
          closeLabel="Close categories"
          opener={categoryOpener}
          onClose={() => setDrawer(null)}
        >
          <CategoryLinks onSelect={() => setDrawer(null)} />
        </Drawer>
      ) : null}
      {drawer === "menu" ? (
        <Drawer
          title="Marketplace menu"
          closeLabel="Close menu"
          opener={menuOpener}
          onClose={() => setDrawer(null)}
        >
          <nav aria-label="Mobile navigation">
            <CategoryLinks onSelect={() => setDrawer(null)} />
            <div className="drawer-account-links">
              {!session ? (
                <>
                  <Link to="/login" onClick={() => setDrawer(null)}>Login</Link>
                  <Link to="/register" onClick={() => setDrawer(null)}>Register</Link>
                </>
              ) : (
                <><Link to="/profile" onClick={() => setDrawer(null)}>Your Profile</Link><button type="button" onClick={signOut}>Logout</button></>
              )}
            </div>
          </nav>
        </Drawer>
      ) : null}
      {drawer === "search" ? (
        <Drawer
          title="Search Services"
          closeLabel="Close search"
          opener={searchOpener}
          onClose={() => setDrawer(null)}
        >
          <form className="drawer-search" role="search" onSubmit={submitSearch}>
            <label htmlFor="drawer-search">What Service do you need?</label>
            <input id="drawer-search" name="query" type="search" />
            <button type="submit">Search</button>
          </form>
        </Drawer>
      ) : null}
    </header>
  );
}
