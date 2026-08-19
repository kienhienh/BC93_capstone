import type { ChangeEvent } from "react";
import { Link } from "react-router-dom";
import type { ServiceDiscoveryItem } from "./capability";
import type { DiscoveryUrlState } from "./screen-model";
import { paginationNumbers } from "./screen-model";

export function ServiceFilters({
  state,
  onChange,
}: {
  state: DiscoveryUrlState;
  onChange: (name: string, value: string) => void;
}) {
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange(event.target.name, event.target.value);
  };

  return (
    <section className="discovery-filters" aria-label="Filter services">
      <label>
        Minimum price
        <input name="minPrice" type="number" min="0" placeholder="$0" value={state.minPrice ?? ""} onChange={handleChange} />
      </label>
      <label>
        Maximum price
        <input name="maxPrice" type="number" min="0" placeholder="Any" value={state.maxPrice ?? ""} onChange={handleChange} />
      </label>
      <label>
        Minimum rating
        <select name="rating" value={state.rating ?? ""} onChange={handleChange}>
          <option value="">Any rating</option>
          <option value="3">3+ stars</option>
          <option value="4">4+ stars</option>
          <option value="5">5 stars</option>
        </select>
      </label>
      <label>
        Sort services
        <select name="sort" value={state.sort} onChange={handleChange}>
          <option value="api">Relevance</option>
          <option value="rating-desc">Best rating</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </label>
    </section>
  );
}

export function ServiceCard({ service }: { service: ServiceDiscoveryItem }) {
  return (
    <Link
      className="discovery-card"
      to={"/services/" + service.id}
      aria-label={service.title + ", from $" + service.price}
    >
      <div className="discovery-card-media">
        {service.imageUrl ? (
          <img src={service.imageUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <span aria-hidden="true">No image</span>
        )}
      </div>
      <div className="discovery-card-body">
        <div className="discovery-seller">
          {service.sellerAvatarUrl ? (
            <img src={service.sellerAvatarUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <span aria-hidden="true">{service.sellerName?.slice(0, 1) || "F"}</span>
          )}
          <strong>{service.sellerName || "Marketplace seller"}</strong>
        </div>
        <h2>{service.title}</h2>
        <p className="discovery-rating">
          <i className="bi bi-star-fill" aria-hidden="true" /> {service.rating ?? "New"}
          {service.commentCount !== null ? " (" + service.commentCount + ")" : ""}
        </p>
        <div className="discovery-price">
          <i className="bi bi-heart" aria-hidden="true" />
          <span>From <strong>${service.price}</strong></span>
        </div>
      </div>
    </Link>
  );
}

export function ServicePagination({
  currentPage,
  pageCount,
  compact,
  onPageChange,
}: {
  currentPage: number;
  pageCount: number;
  compact: boolean;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  const numbers = paginationNumbers(pageCount, currentPage, compact);

  return (
    <nav className="discovery-pagination" aria-label="Service result pages">
      <button type="button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
        Previous page
      </button>
      {numbers.map((number) => (
        <button
          type="button"
          aria-current={number === currentPage ? "page" : undefined}
          key={number}
          onClick={() => onPageChange(number)}
        >
          {number}
        </button>
      ))}
      <button type="button" disabled={currentPage === pageCount} onClick={() => onPageChange(currentPage + 1)}>
        Next page
      </button>
    </nav>
  );
}
