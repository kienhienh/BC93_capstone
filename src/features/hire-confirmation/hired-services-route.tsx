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
  const hiredServices = useHiredServices(session?.token ?? null, session?.user.id ?? null);
  const state = location.state as { message?: string } | null;

  useEffect(() => {
    if (!session) navigate(`/login?returnTo=${encodeURIComponent(location.pathname)}`, { replace: true });
  }, [location.pathname, navigate, session]);

  useEffect(() => {
    document.title = "Hired Services | Fiverr Clone";
    heading.current?.focus();
  }, []);

  if (!session) return null;

  const items = hiredServices.data ?? [];
  const activeServices = items.filter((item) => !item.completed).sort((a, b) => new Date(b.hiredAt).getTime() - new Date(a.hiredAt).getTime());
  const completedServices = items.filter((item) => item.completed).sort((a, b) => new Date(b.hiredAt).getTime() - new Date(a.hiredAt).getTime());

  return (
    <main id="main-content" className="hired-services-page">
      <header className="hired-services-header">
        <h1 ref={heading} tabIndex={-1}>Hired Services</h1>
        <button
          className="hired-services-refresh"
          type="button"
          onClick={() => void hiredServices.refetch()}
          disabled={hiredServices.isFetching}
        >
          {hiredServices.isFetching ? "Refreshing Hired Services..." : "Refresh Hired Services"}
        </button>
      </header>

      {state?.message ? <p className="hired-services-status" role="status">{state.message}</p> : null}
      {hiredServices.isPending ? <p className="hired-services-status" role="status">Loading Hired Services...</p> : null}
      {hiredServices.error ? <p className="hired-services-error" role="alert">Hired Services are temporarily unavailable.</p> : null}

      {!hiredServices.isPending && !hiredServices.error && items.length === 0 ? (
        <p className="hired-services-empty">You have not hired any Services yet.</p>
      ) : null}

      {!hiredServices.isPending && !hiredServices.error && activeServices.length > 0 ? (
        <section>
          <h2 className="hired-services-group-title">Active</h2>
          <div className="hired-services-list">
            {activeServices.map((item) => {
              const title = item.service?.title ?? `Service #${item.serviceId}`;
              const seller = item.seller?.name ?? "Unknown seller";
              const date = new Date(item.hiredAt).toLocaleDateString();
              return (
                <article key={item.id} aria-label={title} className="hired-service-item">
                  <div className="hired-service-header">
                    <h3>{title}</h3>
                    <span className="hired-service-tag hired-service-tag--progress">In progress</span>
                  </div>
                  <p className="hired-service-seller">By {seller}</p>
                  <p className="hired-service-date">Hired on {date}</p>
                  {item.service ? <p className="hired-service-price">${item.service.price}</p> : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {!hiredServices.isPending && !hiredServices.error && completedServices.length > 0 ? (
        <section>
          <h2 className="hired-services-group-title">Completed</h2>
          <div className="hired-services-list">
            {completedServices.map((item) => {
              const title = item.service?.title ?? `Service #${item.serviceId}`;
              const seller = item.seller?.name ?? "Unknown seller";
              const date = new Date(item.hiredAt).toLocaleDateString();
              return (
                <article key={item.id} aria-label={title} className="hired-service-item hired-service-item--completed">
                  <div className="hired-service-header">
                    <h3>{title}</h3>
                    <span className="hired-service-tag hired-service-tag--done">Completed</span>
                  </div>
                  <p className="hired-service-seller">By {seller}</p>
                  <p className="hired-service-date">Hired on {date}</p>
                  {item.service ? <p className="hired-service-price">${item.service.price}</p> : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}
