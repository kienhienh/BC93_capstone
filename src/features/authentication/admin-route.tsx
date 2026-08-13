import { useEffect, useRef, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "./session";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const location = useLocation();

  if (!session) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (session.user.role !== "ADMIN") return <InsufficientPermission />;
  return <>{children}</>;
}

function InsufficientPermission() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = "Insufficient permission | Fiverr Clone";
    heading.current?.focus();
  }, []);

  return (
    <main id="main-content" className="authorization-message">
      <h1 ref={heading} tabIndex={-1}>Insufficient permission</h1>
      <p role="alert">Your account does not have permission to use this page.</p>
    </main>
  );
}
