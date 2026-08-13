import { Link } from "react-router-dom";
import {
  useServicePreviewScreenModel,
  type ServicePreviewScreenItem,
} from "../features/service-preview/public";

const previewLimit = 6;

function ServiceCard({ service }: { service: ServicePreviewScreenItem }) {
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
            <strong>From {service.price}</strong>
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

export default function Home() {
  const preview = useServicePreviewScreenModel();

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
          {preview.canRefresh ? (
            <button type="button" onClick={preview.refresh} disabled={preview.isRefreshing}>
              {preview.isRefreshing ? "Refreshing..." : "Refresh services"}
            </button>
          ) : null}
        </div>

        {preview.isLoading ? <LoadingPreview /> : null}
        {preview.errorMessage ? (
          <div className="service-preview-state" role="alert">
            <p>{preview.errorMessage}</p>
            <button type="button" onClick={preview.refresh}>
              Try again
            </button>
          </div>
        ) : null}
        {preview.isEmpty ? (
          <p className="service-preview-state">No Services are available yet.</p>
        ) : null}
        {preview.services.length > 0 ? (
          <div className="service-preview-grid">
            {preview.services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        ) : null}
        {preview.isRefreshing ? (
          <p className="service-preview-refreshing" role="status">
            Refreshing services...
          </p>
        ) : null}
      </section>
    </main>
  );
}
