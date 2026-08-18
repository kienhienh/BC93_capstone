import { AdminHiredServiceManagementFailure } from "./capability";

export const VALID_PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;
export type FailureKind = AdminHiredServiceManagementFailure["kind"] | "unknown";

export const STATUS_FILTERS = ["all", "active", "completed"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return value && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function pageSizeFrom(value: string | null) {
  const parsed = Number(value);
  return VALID_PAGE_SIZES.some((size) => size === parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

export function statusFilterFrom(value: string | null): StatusFilter {
  return STATUS_FILTERS.find((status) => status === value) ?? "all";
}

export function kindOf(error: unknown): FailureKind {
  return error instanceof AdminHiredServiceManagementFailure ? error.kind : "unknown";
}

export function listPath(search: string) {
  return `/admin/hired-services${search}`;
}

export function withSearch(path: string, search: string) {
  return `${path}${search}`;
}
