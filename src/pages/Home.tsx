import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import businessHeroImage from "../assets/1723672163256.jpg";
import heroImage from "../assets/hero.png";
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
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Home | Fiverr Marketplace";
    headingRef.current?.focus();
  }, []);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim().replace(/\s+/g, " ");
    if (query) navigate(`/services?search=${encodeURIComponent(query)}`);
  };

  return (
    <main id="main-content" className="home-page">
      <header className="home-hero">
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <h1 ref={headingRef} tabIndex={-1}>
              Find the perfect <em>freelance</em> services for your business
            </h1>
            <form className="home-search" role="search" onSubmit={submitSearch}>
              <label className="visually-hidden" htmlFor="home-search">
                Search services from Home
              </label>
              <input
                id="home-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={'Try "building mobile app"'}
              />
              <button type="submit" aria-label="Search from Home">Search</button>
            </form>
            <nav className="popular-searches" aria-label="Popular searches">
              <span>Popular:</span>
              {["Website Design", "WordPress", "Logo Design", "Dropshipping"].map((term) => (
                <Link key={term} to={`/services?search=${encodeURIComponent(term)}`}>{term}</Link>
              ))}
            </nav>
          </div>
          <div className="home-hero-person">
            <img
              src={businessHeroImage}
              alt="Business growth and professional services"
              width="753"
              height="424"
            />
            <p><strong>Expert Services for every business goal</strong></p>
          </div>
        </div>
      </header>

      <section className="trusted-brands" aria-label="Trusted by">
        <span>Trusted by:</span>
        <strong>Facebook</strong>
        <strong>Google</strong>
        <strong>Netflix</strong>
        <strong>P&amp;G</strong>
        <strong>PayPal</strong>
      </section>

      <section className="home-taxonomy" aria-label="Browse service categories">
        <div className="section-heading">
          <div>
            <h2 id="taxonomy-heading">Explore the marketplace</h2>
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

      <section className="service-preview" aria-label="Explore services">
        <div className="service-preview-heading">
          <div>
            <h2 id="service-preview-heading">Popular professional services</h2>
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

      <section className="home-benefits" aria-labelledby="benefits-heading">
        <div className="benefits-copy">
          <h2 id="benefits-heading">A whole world of freelance talent at your fingertips</h2>
          <ul>
            <li><strong>The best for every budget</strong><span>Find high-quality Services at every price point.</span></li>
            <li><strong>Quality work done quickly</strong><span>Find the right Seller to begin your project within minutes.</span></li>
            <li><strong>Protected engagements, every time</strong><span>Approve the work only when it meets your needs.</span></li>
            <li><strong>24/7 support</strong><span>Get help whenever you need it, wherever you are.</span></li>
          </ul>
        </div>
        <div className="benefits-visual" aria-label="Marketplace introduction video">
          {preview.services[0]?.imageUrl ? (
            <img src={preview.services[0].imageUrl} alt="" width="640" height="420" />
          ) : null}
          <button type="button" aria-label="Play marketplace introduction">
            <span aria-hidden="true">▶</span>
          </button>
        </div>
      </section>

      <section className="home-testimonial" aria-labelledby="testimonial-heading">
        <div className="testimonial-portrait" aria-hidden="true">
          <img src={heroImage} alt="" width="343" height="361" />
          <span>▶</span>
        </div>
        <div>
          <h2 id="testimonial-heading">What clients say</h2>
          <p className="testimonial-person">Kay Kim, Co-Founder · rooted</p>
          <blockquote>
            “It is extremely exciting that Fiverr has freelancers from all over the world —
            it broadens the talent pool. One of the best things about Fiverr is that while
            you are sleeping, someone is working.”
          </blockquote>
        </div>
      </section>
    </main>
  );
}
