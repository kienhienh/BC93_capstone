import { createContext, useContext } from "react";
import type { AuthenticatedSession, AuthenticationCapability } from "./capability";

export interface AuthenticationContextValue {
  capability: AuthenticationCapability;
  session: AuthenticatedSession | null;
  acceptSession(session: AuthenticatedSession): void;
  clearSession(): void;
}

export const AuthenticationContext = createContext<AuthenticationContextValue | null>(null);

export function useAuthenticationContext() {
  const context = useContext(AuthenticationContext);
  if (!context) {
    throw new Error("Authentication capability is unavailable.");
  }
  return context;
}
