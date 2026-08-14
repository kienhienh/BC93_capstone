import { useEffect, useMemo, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTaxonomy } from "../taxonomy/public";
import { useServiceDiscovery } from "./controller";
import {
  canonicalDiscoveryParams,
  discoveryHeading,
  filterAndSortServices,
  hasInvalidPriceRange,
  paginateServices,
  parseDiscoveryUrlState,
  serviceDiscoveryErrorMessage,
  updateDiscoveryParams,
} from "./screen-model";
import {
  ServiceCard,
  ServiceFilters,
  ServicePagination,
} from "./view";
import { useCompactPagination } from "./responsive";
import "./service-discovery.css";

function DiscoveryContent({ categoryId }: { categoryId?: string }) {
  const [params, setParams] = useSearchParams();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const taxonomy = useTaxonomy();
  const state = useMemo(() => parseDiscoveryUrlState(params), [params]);
  const query = useServiceDiscovery(state.search, state.subcategoryId);
  const compactPagination = useCompactPagination();

  const category = taxonomy.data?.find((item) => item.id === categoryId);
  const subcategory = taxonomy.data
    ?.flatMap((item) => item.groups)
    .flatMap((group) => group.subcategories)
    .find((item) => item.id === state.subcategoryId);
  const unavailableCategory = Boolean(categoryId && taxonomy.isSuccess && !category);
  const unavailableSubcategory = Boolean(
    state.subcategoryId && taxonomy.isSuccess && !subcategory,
  );
  const heading = discoveryHeading(state.search, subcategory?.name, category?.name);

  useEffect(() => {
    const canonical = canonicalDiscoveryParams(state);
    if (canonical.toString() !== params.toString()) {
      setParams(canonical, { replace: true });
    }
  }, [params, setParams, state]);

  const filtered = useMemo(
    () => filterAndSortServices(query.data ?? [], state),
    [query.data, state],
  );
  const page = paginateServices(filtered, state.page);

  useEffect(() => {
    if (!query.isSuccess || state.page === page.currentPage) return;
    const next = updateDiscoveryParams(params, "page", String(page.currentPage));
    setParams(next, { replace: true });
  }, [page.currentPage, params, query.isSuccess, setParams, state.page]);

  useEffect(() => {
    document.title = heading + " | Fiverr Marketplace";
    headingRef.current?.focus();
  }, [heading]);

  const update = (name: string, value: string) => {
    setParams(updateDiscoveryParams(params, name, value));
  };
  const unavailable = unavailableCategory || unavailableSubcategory;

  return (
    <main id="main-content" className="discovery-page">
      {category ? (
        <nav className="discovery-subcategories" aria-label={category.name + " subcategories"}>
          {category.groups.flatMap((group) => group.subcategories).map((item) => (
            <Link key={item.id} to={"/categories/" + category.id + "?subcategory=" + item.id}>
              {item.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <h1 ref={headingRef} tabIndex={-1}>{heading}</h1>
      <ServiceFilters state={state} onChange={update} />

      {hasInvalidPriceRange(state) ? (
        <p className="discovery-validation" role="alert">
          Minimum price cannot be greater than maximum price.
        </p>
      ) : null}
      {unavailable ? (
        <div className="discovery-state" role="alert">
          <h2>{unavailableCategory ? "Service Category unavailable" : "Service Subcategory unavailable"}</h2>
          <p>The requested marketplace classification does not exist.</p>
        </div>
      ) : null}
      {!unavailable && query.isPending ? (
        <div className="discovery-loading" role="status" aria-label="Loading services" aria-busy="true">
          Loading Services...
        </div>
      ) : null}
      {!unavailable && query.isFetching && !query.isPending ? (
        <p className="discovery-refresh" role="status">Refreshing Services...</p>
      ) : null}
      {!unavailable && query.isError ? (
        <div className="discovery-state" role="alert">
          <p>{serviceDiscoveryErrorMessage(query.error)}</p>
          <button type="button" onClick={() => void query.refetch()}>Try again</button>
        </div>
      ) : null}
      {!unavailable && query.isSuccess ? (
        <>
          <div className="discovery-summary">
            <p>{filtered.length} services available</p>
            <div>
              <button type="button" onClick={() => void query.refetch()}>Refresh results</button>
              <span>Sort by <strong>{state.sort === "api" ? "Relevance" : "Selected option"}</strong></span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="discovery-state">
              <h2>{query.data.length === 0 ? "No Services are available" : "No Services match these filters"}</h2>
              <p>{query.data.length === 0 ? "Try another search or Service Subcategory." : "Try changing your price or rating filters."}</p>
            </div>
          ) : (
            <section className="discovery-grid" aria-label="Service results">
              {page.services.map((service) => <ServiceCard key={service.id} service={service} />)}
            </section>
          )}
          <ServicePagination
            currentPage={page.currentPage}
            pageCount={page.pageCount}
            compact={compactPagination}
            onPageChange={(number) => update("page", String(number))}
          />
        </>
      ) : null}
    </main>
  );
}

export function ServiceDiscoveryRoute() {
  return <DiscoveryContent />;
}

export function CategoryDiscoveryRoute() {
  const { categoryId } = useParams<{ categoryId: string }>();
  return <DiscoveryContent categoryId={categoryId} />;
}
