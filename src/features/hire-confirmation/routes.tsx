import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { reportAuthorizationFailure, useSession } from "../authentication/public";
import { HireFailure } from "./capability";
import { useCheckHiredService, useConfirmHire, useHireService } from "./controller";
import "./hire-confirmation.css";

export function HireConfirmationRoute() {
  const { serviceId = "" } = useParams();
  const { session } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const service = useHireService(serviceId, Boolean(session));
  const confirmation = useConfirmHire();
  const hiredServiceCheck = useCheckHiredService();
  const [failure, setFailure] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [pendingHireCheck, setPendingHireCheck] = useState<{
    kind: "accepted" | "unknown";
    hireId?: string;
    serviceId: string;
    userId: string;
    hiredAt: string;
  } | null>(null);

  useEffect(() => {
    if (!session) navigate(`/login?returnTo=${encodeURIComponent(location.pathname)}`, { replace: true });
  }, [location.pathname, navigate, session]);

  useEffect(() => {
    if (!service.data) return;
    document.title = `Confirm Hire | ${service.data.title}`;
    heading.current?.focus();
  }, [service.data]);

  if (!session) return null;
  if (service.isPending) return <main id="main-content"><p role="status">Loading current Service...</p></main>;
  if (!service.data) {
    const missing = service.error instanceof HireFailure && service.error.kind === "not_found";
    return (
      <main id="main-content" className="hire-confirmation-page">
        <h1>{missing ? "Service not found" : "Hire unavailable"}</h1>
        <p role="alert">
          {missing
            ? "This Service is no longer available to hire."
            : "We could not load the latest Service details."}
        </p>
        {!missing ? (
          <button className="hire-secondary-button" type="button" onClick={() => void service.refetch()}>
            Try loading Service again
          </button>
        ) : null}
        <Link className="hire-back-link" to="/services">Browse Services</Link>
      </main>
    );
  }
  const sellerMissing = !service.data.seller;

  async function confirmHire() {
    if (!session || !service.data) return;
    setFailure(null);
    setNeedsReload(false);
    setCanRetry(false);
    setPendingHireCheck(null);
    try {
      const confirmed = await confirmation.mutateAsync({
        reviewed: service.data,
        userId: session.user.id,
        sessionToken: session.token,
        hiredAt: new Date(Date.now()).toISOString(),
      });
      navigate("/hired-services", {
        replace: true,
        state: { message: `${confirmed.service.title} was hired successfully.` },
      });
    } catch (error) {
      if (error instanceof HireFailure && error.kind === "unauthorized") {
        reportAuthorizationFailure(401);
      } else if (error instanceof HireFailure && error.kind === "forbidden") {
        reportAuthorizationFailure(403);
      } else if (error instanceof HireFailure && error.kind === "self_hire") {
        setFailure("You cannot hire your own Service.");
      } else if (error instanceof HireFailure && error.kind === "not_found") {
        setFailure("This Service is no longer available to hire.");
      } else if (error instanceof HireFailure && error.kind === "stale") {
        setNeedsReload(true);
        setFailure("Service details changed. Review the latest information before hiring.");
      } else if (error instanceof HireFailure && error.kind === "unknown_reconciled") {
        setCanRetry(true);
        setFailure("We could not confirm whether the Hire was created. Hired Services were checked before Retry.");
      } else if (error instanceof HireFailure && error.kind === "accepted_pending" && error.pending) {
        setPendingHireCheck({ kind: "accepted", hireId: error.hireId, ...error.pending });
        setFailure("The server accepted this Hire, but it is not visible yet.");
      } else if (error instanceof HireFailure && error.kind === "reconciliation_failed" && error.pending) {
        setPendingHireCheck({ kind: "unknown", ...error.pending });
        setFailure("We could not check Hired Services. Check again before Retry.");
      } else if (error instanceof HireFailure && error.kind === "server") {
        setCanRetry(true);
        setFailure("Hire is temporarily unavailable. No Hire was created.");
      } else if (error instanceof HireFailure && error.kind === "offline") {
        setCanRetry(true);
        setFailure("You are offline. Reconnect before trying this Hire again.");
      } else {
        setFailure("We could not confirm this Hire. Try again.");
      }
    }
  }

  return (
    <main id="main-content" className="hire-confirmation-page">
      <header className="hire-confirmation-intro">
        <p className="hire-confirmation-eyebrow">Review before you hire</p>
        <h1 ref={heading} tabIndex={-1}>Confirm your Hire</h1>
        <p>Check the latest Service, Seller, and price. These details cannot be edited here.</p>
      </header>
      <div className="hire-confirmation-layout">
      <section className="hire-review-card" aria-label="Hire summary">
        <span className="hire-review-card__label">Service</span>
        <h2>{service.data.title}</h2>
        <div className="hire-review-list">
          <p>Seller: {service.data.seller?.name ?? "Unavailable"}</p>
          <p>Current price: ${service.data.price}</p>
        </div>
        <div className="hire-review-note">
          <strong>Fresh details, safer confirmation</strong>
          <p>We check this Service again immediately before sending your Hire.</p>
        </div>
      </section>
      <aside className="hire-action-card" aria-label="Hire action">
      <p className="hire-action-card__eyebrow">Total</p>
      <p className="hire-action-card__price">${service.data.price}</p>
      <p className="hire-action-card__note">You will hire this Service at the current price shown.</p>
      {sellerMissing ? (
        <p className="hire-message hire-message--error" role="alert">Seller information is unavailable, so this Service cannot be hired safely.</p>
      ) : null}
      {confirmation.isPending ? <p className="hire-message" role="status">Confirming Hire...</p> : null}
      {failure ? <p className="hire-message hire-message--error" role="alert">{failure}</p> : null}
      {needsReload ? (
        <button className="hire-secondary-button" type="button" onClick={async () => {
          await service.refetch();
          setNeedsReload(false);
          setFailure(null);
        }}>
          Reload latest
        </button>
      ) : null}
      {pendingHireCheck ? (
        <>
          <button className="hire-primary-button" type="button" disabled>Hire awaiting confirmation</button>
          <button className="hire-secondary-button" type="button" disabled={hiredServiceCheck.isPending} onClick={async () => {
            if (!session) return;
            const observed = await hiredServiceCheck.mutateAsync({
              sessionToken: session.token,
              ...pendingHireCheck,
            });
            if (observed) {
              navigate("/hired-services", {
                replace: true,
                state: { message: `${service.data.title} was hired successfully.` },
              });
            } else {
              if (pendingHireCheck.kind === "accepted") {
                setFailure("The server accepted this Hire, but it is not visible yet.");
              } else {
                setPendingHireCheck(null);
                setCanRetry(true);
                setFailure("Hired Services were checked. You can Retry this Hire.");
              }
            }
          }}>
            {hiredServiceCheck.isPending ? "Checking Hired Services..." : "Check Hired Services"}
          </button>
        </>
      ) : (
        <button className="hire-primary-button" type="button" onClick={confirmHire} disabled={confirmation.isPending || sellerMissing}>
          {confirmation.isPending ? "Confirming Hire..." : canRetry ? "Retry Hire" : "Confirm Hire"}
        </button>
      )}
      <Link className="hire-back-link" to={`/services/${encodeURIComponent(service.data.id)}`}>Back to Service</Link>
      </aside>
      </div>
    </main>
  );
}
