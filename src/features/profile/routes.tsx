import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { reportAuthorizationFailure, useSession } from "../authentication/public";
import { useHiredServices } from "../hire-confirmation/public";
import { ProfileFailure } from "./capability";
import { useCurrentProfile } from "./controller";
import { ProfileView } from "./view";
import "./profile.css";

export function ProfileRoute() {
  const { session, acceptSession, logout } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!session) navigate(`/login?returnTo=${encodeURIComponent(location.pathname)}`, { replace: true });
  }, [location.pathname, navigate, session]);

  if (!session) return null;
  return (
    <AuthenticatedProfile
      session={session}
      acceptSession={acceptSession}
      logout={() => { logout(); navigate("/"); }}
      heading={heading}
    />
  );
}

function AuthenticatedProfile({ session, acceptSession, logout, heading }: {
  session: NonNullable<ReturnType<typeof useSession>["session"]>;
  acceptSession: ReturnType<typeof useSession>["acceptSession"];
  logout: () => void;
  heading: React.RefObject<HTMLHeadingElement | null>;
}) {
  const profile = useCurrentProfile(session.user.id, session.token);
  const hiredServices = useHiredServices(session.token, session.user.id);

  useEffect(() => { document.title = "Your Profile | Fiverr Clone"; }, []);
  useEffect(() => {
    if (profile.error instanceof ProfileFailure && profile.error.kind === "unauthorized") reportAuthorizationFailure(401);
    else if (profile.error instanceof ProfileFailure && profile.error.kind === "forbidden") reportAuthorizationFailure(403);
    if (profile.isError) heading.current?.focus();
  }, [heading, profile.error, profile.isError]);

  if (profile.isPending) return <main id="main-content" className="profile-page"><p role="status">Loading your Profile...</p></main>;
  if (profile.isError || !profile.data) {
    return <main id="main-content" className="profile-page"><h1 ref={heading} tabIndex={-1}>Profile unavailable</h1><p role="alert">Your Profile could not be loaded safely.</p><a href="/">Home</a><button onClick={logout}>Logout</button></main>;
  }
  return <ProfileView profile={profile.data} session={session} acceptSession={acceptSession} hiredServices={hiredServices} heading={heading} />;
}
