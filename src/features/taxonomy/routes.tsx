import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { categoryPresentation } from "./category-presentation";
import { useCategoryTaxonomy } from "./controller";
import { taxonomyFailureMessage } from "./screen-model";
import "./category-landing.css";

function CategoryPageState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = `${title} | Fiverr Marketplace`;
    headingRef.current?.focus();
  }, [title]);

  return (
    <main id="main-content" className="category-landing category-landing-state">
      <div>
        <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
        {children}
      </div>
    </main>
  );
}

export function CategoryLandingRoute() {
  const { categoryId = "" } = useParams<{ categoryId: string }>();
  const taxonomy = useCategoryTaxonomy();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const category = taxonomy.data?.find((item) => item.id === categoryId);
  const presentation = category ? categoryPresentation(category.name) : null;
  const groups = useMemo(
    () => category?.groups.filter((group) => group.subcategories.length > 0) ?? [],
    [category],
  );
  const subcategories = useMemo(
    () => groups.flatMap((group) => group.subcategories),
    [groups],
  );
  const featured = useMemo(() => {
    if (!presentation) return subcategories.slice(0, 5);
    const byName = new Map(
      subcategories.map((subcategory) => [subcategory.name.trim().toLowerCase(), subcategory]),
    );
    const configured = presentation.featuredSubcategoryNames.flatMap((name) => {
      const match = byName.get(name.toLowerCase());
      return match ? [match] : [];
    });
    const configuredIds = new Set(configured.map((subcategory) => subcategory.id));
    return [
      ...configured,
      ...subcategories.filter((subcategory) => !configuredIds.has(subcategory.id)),
    ].slice(0, 5);
  }, [presentation, subcategories]);
  const relatedSearches = useMemo(
    () => presentation?.relatedSearches.length
      ? presentation.relatedSearches
      : subcategories.slice(0, 20).map((subcategory) => subcategory.name),
    [presentation, subcategories],
  );
  const featuredHeading = presentation
    ? `Most popular in ${category?.name ?? "this Category"}`
    : `Featured in ${category?.name ?? "this Category"}`;

  useEffect(() => {
    if (!category) return;
    document.title = `${category.name} | Fiverr Marketplace`;
    headingRef.current?.focus();
  }, [category]);

  if (taxonomy.isPending) {
    return (
      <main id="main-content" className="category-landing category-landing-loading">
        <section
          className="category-hero category-loading-hero"
          aria-label="Service Category preview"
        >
          <div className="category-hero-copy">
            <h1>Explore Service Categories</h1>
            <p
              role="status"
              aria-label="Loading Service Category"
              aria-busy="true"
            >
              Loading Service Category...
            </p>
          </div>
        </section>
        <div className="category-loading-sections" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </main>
    );
  }

  if (taxonomy.isError) {
    return (
      <CategoryPageState title="Service Category unavailable">
        <div role="alert">
          <p>{taxonomyFailureMessage(taxonomy.error)}</p>
          <button type="button" onClick={() => void taxonomy.refetch()}>Try again</button>
        </div>
      </CategoryPageState>
    );
  }

  if (taxonomy.data.length === 0) {
    return (
      <CategoryPageState title="No Service Categories are available">
        <p>There are no Service Categories to explore right now.</p>
        <Link to="/services">Browse all Services</Link>
      </CategoryPageState>
    );
  }

  if (!category) {
    return (
      <CategoryPageState title="Service Category not found">
        <p>The requested Service Category does not exist.</p>
        <Link to="/services">Browse all Services</Link>
      </CategoryPageState>
    );
  }

  return (
    <main id="main-content" className="category-landing">
      {taxonomy.isFetching ? (
        <p className="category-refresh-status" role="status" aria-label="Refreshing Service Category">
          Refreshing Service Category...
        </p>
      ) : taxonomy.isFetchedAfterMount ? (
        <p className="visually-hidden" role="status">Service Category is up to date.</p>
      ) : null}
      <section className="category-hero" aria-labelledby="category-heading">
        <div className="category-hero-decoration category-hero-decoration-left" aria-hidden="true" />
        <div className="category-hero-copy">
          <h1 id="category-heading" ref={headingRef} tabIndex={-1}>{category.name}</h1>
          <p>{presentation?.subtitle ?? `Explore services across ${category.name}.`}</p>
          <a className="category-hero-action" href="#explore-category">
            <i className="bi bi-play-circle-fill" aria-hidden="true" /> Explore this Category
          </a>
        </div>
        <div className="category-hero-decoration category-hero-decoration-right" aria-hidden="true" />
      </section>

      <section className="category-featured" aria-labelledby="featured-heading">
        <div className="category-section-heading">
          <h2 id="featured-heading">{featuredHeading}</h2>
        </div>
        {featured.length > 0 ? (
          <nav aria-label={`Featured ${category.name} services`}>
            <ul>
              {featured.map((subcategory, index) => (
                <li key={subcategory.id}>
                  <Link to={`/services?subcategory=${encodeURIComponent(subcategory.id)}`}>
                    <span className={`category-featured-icon category-featured-icon-${index % 5}`} aria-hidden="true">
                      <i className="bi bi-stars" />
                    </span>
                    <span>{subcategory.name}</span>
                    <i className="bi bi-arrow-right" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <p className="category-empty">No featured Service Subcategories are available yet.</p>
        )}
      </section>

      <section
        id="explore-category"
        className="category-explore"
        aria-labelledby="explore-category-heading"
      >
        <h2 id="explore-category-heading">Explore {category.name}</h2>
        {groups.length === 0 ? (
          <p className="category-empty">No Service Subcategories are available in this Category yet.</p>
        ) : (
          <div className="category-group-grid">
            {groups.map((group) => (
              <article className="category-group-card" key={group.id}>
                <div className="category-group-media">
                  {group.imageUrl ? (
                    <img src={group.imageUrl} alt={group.name} width="560" height="320" loading="lazy" decoding="async" />
                  ) : (
                    <span aria-hidden="true"><i className="bi bi-grid" /></span>
                  )}
                </div>
                <h3>{group.name}</h3>
                <ul>
                  {group.subcategories.map((subcategory) => (
                    <li key={subcategory.id}>
                      <Link to={`/services?subcategory=${encodeURIComponent(subcategory.id)}`}>
                        {subcategory.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="category-related" aria-labelledby="related-heading">
        <h2 id="related-heading">Services related to {category.name}</h2>
        {relatedSearches.length > 0 ? (
          <nav aria-label={`Services related to ${category.name}`}>
            <ul>
              {relatedSearches.map((term) => (
                <li key={term}>
                  <Link to={`/services?search=${encodeURIComponent(term)}`}>{term}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <p className="category-empty">No related Service searches are available yet.</p>
        )}
      </section>
    </main>
  );
}
