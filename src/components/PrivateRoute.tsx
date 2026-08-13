import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "../features/authentication/public";

interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { session } = useSession();
  const location = useLocation();

  if (!session) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return <>{children}</>;
};

export default PrivateRoute;
