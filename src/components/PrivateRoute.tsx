import React from "react";
import { Navigate } from "react-router-dom";
import { getAccessToken, getClientId } from "../services/auth";

interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const token = getAccessToken();
  const clientId = getClientId();

  if (!token || clientId === null) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default PrivateRoute;
