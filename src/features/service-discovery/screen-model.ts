import type {
  ServiceDiscoveryFailure,
  ServiceDiscoveryItem,
} from "./capability";

export const PAGE_SIZE = 12;

export type ServiceSort =
  | "api"
  | "rating-desc"
  | "price-asc"
  | "price-desc";

export interface DiscoveryUrlState {
  search: string;
  subcategoryId: string;
  minPrice: number | null;
  maxPrice: number | null;
  rating: number | null;
  sort: ServiceSort;
  page: number;
}

const allowedSorts = new Set<ServiceSort>([
  "api",
  "rating-desc",
  "price-asc",
  "price-desc",
]);

function normalizedText(value: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function nonnegativeNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseDiscoveryUrlState(params: URLSearchParams): DiscoveryUrlState {
  const search = normalizedText(params.get("search"));
  const ratingParam = params.get("rating");
  const sortParam = params.get("sort") as ServiceSort | null;
  const pageParam = Number(params.get("page") ?? "1");

  return {
    search,
    subcategoryId: search ? "" : normalizedText(params.get("subcategory")),
    minPrice: nonnegativeNumber(params.get("minPrice")),
    maxPrice: nonnegativeNumber(params.get("maxPrice")),
    rating:
      ratingParam && ["3", "4", "5"].includes(ratingParam)
        ? Number(ratingParam)
        : null,
    sort: sortParam && allowedSorts.has(sortParam) ? sortParam : "api",
    page: Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1,
  };
}

export function canonicalDiscoveryParams(state: DiscoveryUrlState) {
  const params = new URLSearchParams();
  if (state.search) params.set("search", state.search);
  else if (state.subcategoryId) params.set("subcategory", state.subcategoryId);
  if (state.minPrice !== null) params.set("minPrice", String(state.minPrice));
  if (state.maxPrice !== null) params.set("maxPrice", String(state.maxPrice));
  if (state.rating !== null) params.set("rating", String(state.rating));
  if (state.sort !== "api") params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));
  return params;
}

export function updateDiscoveryParams(
  current: URLSearchParams,
  name: string,
  value: string,
) {
  const next = new URLSearchParams(current);
  if (value) next.set(name, value);
  else next.delete(name);
  if (name !== "page") next.delete("page");
  return next;
}

export function hasInvalidPriceRange(state: DiscoveryUrlState) {
  return (
    state.minPrice !== null &&
    state.maxPrice !== null &&
    state.minPrice > state.maxPrice
  );
}

export function filterAndSortServices(
  services: readonly ServiceDiscoveryItem[],
  state: DiscoveryUrlState,
) {
  const invalidRange = hasInvalidPriceRange(state);
  const entries = services.map((service, index) => ({ service, index }));
  const filtered = entries.filter(({ service }) => {
    if (!invalidRange && state.minPrice !== null && service.price < state.minPrice) return false;
    if (!invalidRange && state.maxPrice !== null && service.price > state.maxPrice) return false;
    return state.rating === null || (service.rating ?? 0) >= state.rating;
  });

  filtered.sort((left, right) => {
    if (state.sort === "rating-desc") {
      return (right.service.rating ?? 0) - (left.service.rating ?? 0) || left.index - right.index;
    }
    if (state.sort === "price-asc") {
      return left.service.price - right.service.price || left.index - right.index;
    }
    if (state.sort === "price-desc") {
      return right.service.price - left.service.price || left.index - right.index;
    }
    return left.index - right.index;
  });

  return filtered.map(({ service }) => service);
}

export function paginateServices(
  services: readonly ServiceDiscoveryItem[],
  requestedPage: number,
) {
  const pageCount = Math.max(1, Math.ceil(services.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  return {
    currentPage,
    pageCount,
    services: services.slice(start, start + PAGE_SIZE),
  };
}

export function paginationNumbers(
  pageCount: number,
  currentPage: number,
  compact: boolean,
) {
  if (!compact) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const visibleCount = Math.min(3, pageCount);
  const start = Math.min(Math.max(currentPage - 1, 1), pageCount - visibleCount + 1);
  return Array.from({ length: visibleCount }, (_, index) => start + index);
}

export function discoveryHeading(
  search: string,
  subcategoryName?: string,
  categoryName?: string,
) {
  if (search) return 'Results for "' + search + '"';
  if (subcategoryName) return "Services for " + subcategoryName;
  return categoryName ?? "All Services";
}

export function serviceDiscoveryErrorMessage(error: Error) {
  const failure = error as ServiceDiscoveryFailure;
  if (failure.kind === "offline") return "You are offline. Reconnect to load Services.";
  if (failure.kind === "network") return "We could not connect to the Service marketplace.";
  if (failure.kind === "malformed") return "The Services response was not in a safe format.";
  if (failure.kind === "server") return "Services are temporarily unavailable.";
  return "Services could not be loaded.";
}
