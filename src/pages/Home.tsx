import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  useServicePreviewScreenModel,
  type ServicePreviewScreenItem,
} from "../features/service-preview/public";
import { taxonomyFailureMessage, useTaxonomy } from "../features/taxonomy/public";

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
  const taxonomy = useTaxonomy();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = "Home | Fiverr Marketplace";
    headingRef.current?.focus();
  }, []);

  return (
    <main id="main-content" className="home-page">
      <header className="home-intro">
        <p className="home-eyebrow">Fiverr Service Marketplace</p>
        <h1 ref={headingRef} tabIndex={-1}>Find the right Service for your next project</h1>
        <p>Browse real Services offered by marketplace Sellers.</p>
      </header>

      <section className="home-taxonomy" aria-labelledby="taxonomy-heading">
        <div className="section-heading">
          <div>
            <p className="home-eyebrow">Browse the marketplace</p>
            <h2 id="taxonomy-heading">Browse service categories</h2>
          </div>
          {taxonomy.data && taxonomy.data.length > 0 ? (
            <button
              type="button"
              onClick={() => void taxonomy.refetch()}
              disabled={taxonomy.isFetching}
            >
              Refresh categories
            </button>
          ) : null}
        </div>
        {taxonomy.isPending ? (
          <p role="status">Loading service categories...</p>
        ) : null}
        {taxonomy.isSuccess && taxonomy.data.length === 0 ? (
          <p className="taxonomy-state">No Service Categories are available yet.</p>
        ) : null}
        {taxonomy.isError ? (
          <div className="taxonomy-state" role="alert">
            <p>{taxonomyFailureMessage(taxonomy.error)}</p>
            <button type="button" onClick={() => void taxonomy.refetch()}>
              Try categories again
            </button>
          </div>
        ) : null}
        {taxonomy.isFetching && !taxonomy.isPending ? (
          <p role="status">Refreshing service categories...</p>
        ) : null}
        {taxonomy.data?.map((category) => (
          <article className="taxonomy-category" key={category.id}>
            <h3>
              <Link to={`/categories/${category.id}`}>{category.name}</Link>
            </h3>
            {category.groups.length === 0 ? (
              <p>No Service Groups are available in {category.name}.</p>
            ) : null}
            <div className="taxonomy-groups">
              {category.groups.map((group) => (
                <section className="taxonomy-group" key={group.id}>
                  <h4>{group.name}</h4>
                  {group.subcategories.length === 0 ? (
                    <p>No Service Subcategories are available in {group.name}.</p>
                  ) : null}
                  <ul>
                    {group.subcategories.map((subcategory) => (
                      <li key={subcategory.id}>
                        <Link to={`/services?subcategory=${subcategory.id}`}>
                          {subcategory.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </article>
        ))}
      </section>

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
