import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  AuthenticatedSession,
  AuthenticationCapability,
  SessionStore,
} from "./capability";
import { AuthenticationContext } from "./context";
import { readTokenExpiration, restoreSession } from "./persisted-session";
import { subscribeToAuthorizationFailures } from "./session-events";

export function AuthenticationProvider({
  capability,
  sessionStore,
  children,
}: {
  capability: AuthenticationCapability;
  sessionStore: SessionStore;
  children: ReactNode;
}) {
  const [initialRead] = useState(() => {
    const value = sessionStore.read();
    const pending = isPromiseLike(value);
    return { value, pending, session: pending ? null : restoreSession(value) };
  });
  const [session, setSession] = useState<AuthenticatedSession | null>(initialRead.session);
  const [restoring, setRestoring] = useState(initialRead.pending);
  const restorationHeading = useRef<HTMLHeadingElement>(null);
  const permissionHeading = useRef<HTMLHeadingElement>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [requiresFreshConfirmation, setRequiresFreshConfirmation] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const applyStoredSession = (storedSession: unknown) => {
      const restored = restoreSession(storedSession);
      if (!restored && storedSession !== null) sessionStore.clear();
      setSession(restored);
      setRestoring(false);
    };
    const unsubscribe = sessionStore.subscribe((storedSession) => {
      applyStoredSession(storedSession);
      setStatusMessage(
        restoreSession(storedSession)
          ? "Your session was updated in another tab."
          : "Your session ended in another tab. Sign in again to continue.",
      );
    });

    if (isPromiseLike(initialRead.value)) {
      initialRead.value.then((storedSession) => {
        if (active) applyStoredSession(storedSession);
      });
    } else if (!initialRead.session && initialRead.value !== null) {
      sessionStore.clear();
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, [initialRead, sessionStore]);

  useEffect(
    () =>
      subscribeToAuthorizationFailures((status) => {
        if (status === 401) {
          sessionStore.clear();
          setSession(null);
          setPermissionDenied(false);
          setRequiresFreshConfirmation(true);
          setStatusMessage("Your session ended. Sign in again to continue.");
          return;
        }
        setPermissionDenied(true);
      }),
    [sessionStore],
  );

  useEffect(() => {
    if (restoring) {
      document.title = "Restoring session | Fiverr Clone";
      restorationHeading.current?.focus();
    }
  }, [restoring]);

  useEffect(() => {
    if (!permissionDenied) return;
    document.title = "Insufficient permission | Fiverr Clone";
    permissionHeading.current?.focus();
  }, [permissionDenied]);

  useEffect(() => {
    if (!session) return;
    const expiresAt = readTokenExpiration(session.token);
    if (expiresAt === null) return;

    let timeout = 0;
    const expire = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        sessionStore.clear();
        setSession(null);
        setStatusMessage("Your session expired. Sign in again to continue.");
        return;
      }
      timeout = window.setTimeout(expire, Math.min(remaining, 2_147_483_647));
    };
    timeout = window.setTimeout(expire, Math.min(expiresAt - Date.now(), 2_147_483_647));
    return () => window.clearTimeout(timeout);
  }, [session, sessionStore]);

  const value = useMemo(
    () => ({
      capability,
      session,
      acceptSession: (nextSession: AuthenticatedSession) => {
        const safeSession = restoreSession(nextSession);
        if (!safeSession) {
          sessionStore.clear();
          setSession(null);
          return;
        }
        sessionStore.save(safeSession);
        setStatusMessage(null);
        setSession(safeSession);
      },
      clearSession: () => {
        sessionStore.clear();
        setSession(null);
        setStatusMessage("You have signed out.");
      },
    }),
    [capability, session, sessionStore],
  );

  if (restoring) {
    return (
      <main className="session-restoration">
        <h1 ref={restorationHeading} tabIndex={-1}>Restoring your session</h1>
        <p role="status" aria-live="polite">Restoring your session...</p>
      </main>
    );
  }

  if (permissionDenied) {
    return (
      <main id="main-content" className="authorization-message">
        <h1 ref={permissionHeading} tabIndex={-1}>Insufficient permission</h1>
        <p role="alert">Your account does not have permission to complete this request.</p>
        <button type="button" onClick={() => setPermissionDenied(false)}>
          Return to current page
        </button>
      </main>
    );
  }

  return (
    <AuthenticationContext.Provider value={value}>
      {statusMessage && <p className="session-status" role="status" aria-live="polite">{statusMessage}</p>}
      {requiresFreshConfirmation && session && (
        <section className="session-confirmation" role="status" aria-live="polite">
          <p>Confirm before trying the action again. It was not run automatically.</p>
          <button type="button" onClick={() => setRequiresFreshConfirmation(false)}>
            Confirm before continuing
          </button>
        </section>
      )}
      {children}
    </AuthenticationContext.Provider>
  );
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return typeof value === "object" && value !== null && "then" in value;
}
