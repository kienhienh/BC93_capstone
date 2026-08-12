import { Link } from "react-router-dom";
import { useServicePreview } from "./controller";
import { ServicePreviewFailure, type ServicePreview } from "./capability";

const previewLimit = 6;

function ServiceCard({ service }: { service: ServicePreview }) {
  return (
    <article className="service-preview-card">
      <Link className="service-preview-link" to={`/services/${service.id}`}>
        <div className="service-preview-image">
          {service.imageUrl ? (
            <img
              src={service.imageUrl}
              alt=""
              width="360"
              height="240"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span aria-hidden="true">Service</span>
          )}
        </div>
        <div className="service-preview-copy">
          <h3>{service.title}</h3>
          {service.description ? <p>{service.description}</p> : null}
          <p className="service-preview-meta">
            <span>{service.rating === null ? "Not rated" : `${service.rating} out of 5`}</span>
            <strong>From ${service.price}</strong>
          </p>
        </div>
      </Link>
    </article>
  );
}

function LoadingPreview() {
  return (
    <div className="service-preview-grid" aria-busy="true" aria-label="Loading services">
      {Array.from({ length: previewLimit }, (_, index) => (
        <div className="service-preview-skeleton" key={index} aria-hidden="true" />
      ))}
      <span className="visually-hidden">Loading services...</span>
    </div>
  );
}

function failureMessage(error: unknown): string {
  if (!(error instanceof ServicePreviewFailure)) {
    return "Services could not be loaded safely. Please try again.";
  }

  switch (error.kind) {
    case "malformed":
      return "The Services response was not in a safe format. Please try again later.";
    case "offline":
      return "You are offline. Reconnect to load Services.";
    case "network":
      return "We could not connect to the Service marketplace. Check your connection and try again.";
    case "server":
      return "Services are temporarily unavailable. Please try again.";
    default:
      return "Services could not be loaded safely. Please try again.";
  }
}

export function HomeRoute() {
  const query = useServicePreview();
  const services = query.data?.slice(0, previewLimit) ?? [];

  return (
    <main id="main-content" className="home-page">
      <header className="home-intro">
        <p className="home-eyebrow">Fiverr Service Marketplace</p>
        <h1>Find the right Service for your next project</h1>
        <p>Browse real Services offered by marketplace Sellers.</p>
      </header>

      <section className="service-preview" aria-labelledby="service-preview-heading">
        <div className="service-preview-heading">
          <div>
            <p className="home-eyebrow">Marketplace preview</p>
            <h2 id="service-preview-heading">Explore services</h2>
          </div>
          {query.data ? (
            <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>
              {query.isFetching ? "Refreshing..." : "Refresh services"}
            </button>
          ) : null}
        </div>

        {query.isPending ? <LoadingPreview /> : null}
        {query.isError ? (
          <div className="service-preview-state" role="alert">
            <p>{failureMessage(query.error)}</p>
            <button type="button" onClick={() => void query.refetch()}>
              Try again
            </button>
          </div>
        ) : null}
        {query.isSuccess && services.length === 0 ? (
          <p className="service-preview-state">No Services are available yet.</p>
        ) : null}
        {services.length > 0 ? (
          <div className="service-preview-grid">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        ) : null}
        {query.isFetching && !query.isPending ? (
          <p className="service-preview-refreshing" role="status">
            Refreshing services...
          </p>
        ) : null}
      </section>
    </main>
  );
}
