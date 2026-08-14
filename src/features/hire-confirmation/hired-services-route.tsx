import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../authentication/public";
import { useHiredServices } from "./controller";
import "./hire-confirmation.css";

export function HiredServicesRoute() {
  const { session } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const hiredServices = useHiredServices(session?.token ?? null);
  const state = location.state as { message?: string } | null;

  useEffect(() => {
    if (!session) navigate(`/login?returnTo=${encodeURIComponent(location.pathname)}`, { replace: true });
  }, [location.pathname, navigate, session]);

  useEffect(() => {
    document.title = "Hired Services | Fiverr Clone";
    heading.current?.focus();
  }, []);

  if (!session) return null;
  return (
    <main id="main-content" className="hired-services-page">
      <div>
        <h1 ref={heading} tabIndex={-1}>Hired Services</h1>
        <button type="button" onClick={() => void hiredServices.refetch()} disabled={hiredServices.isFetching}>
          {hiredServices.isFetching ? "Refreshing Hired Services..." : "Refresh Hired Services"}
        </button>
      </div>
      {state?.message ? <p role="status">{state.message}</p> : null}
      {hiredServices.isPending ? <p role="status">Loading Hired Services...</p> : null}
      {hiredServices.error ? <p role="alert">Hired Services are temporarily unavailable.</p> : null}
      {hiredServices.data?.map((item) => {
        const title = item.service?.title ?? `Service #${item.serviceId}`;
        return (
          <article key={item.id} aria-label={title}>
            <h2>{title}</h2>
            {item.service ? <p>${item.service.price}</p> : null}
            <p>{item.completed ? "Completed" : "In progress"}</p>
          </article>
        );
      })}
      {hiredServices.data?.length === 0 ? <p>You have not hired any Services yet.</p> : null}
    </main>
  );
}
