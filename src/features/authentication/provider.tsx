import { useMemo, useState, type ReactNode } from "react";
import type { AuthenticatedSession, AuthenticationCapability } from "./capability";
import { AuthenticationContext } from "./context";

export function AuthenticationProvider({
  capability,
  children,
}: {
  capability: AuthenticationCapability;
  children: ReactNode;
}) {
  const [session, setSession] = useState<AuthenticatedSession | null>(null);
  const value = useMemo(
    () => ({
      capability,
      session,
      acceptSession: setSession,
      clearSession: () => setSession(null),
    }),
    [capability, session],
  );

  return (
    <AuthenticationContext.Provider value={value}>
      {children}
    </AuthenticationContext.Provider>
  );
}
