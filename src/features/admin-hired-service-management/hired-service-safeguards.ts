import type {
  AdminHiredService,
  AdminHiredServiceEvidence,
  AdminHiredServiceListParams,
  AdminHiredServiceListResult,
} from "./capability";
import type { StatusFilter } from "./route-utils";

export type GuardFeedback = {
  state: "blocked-dependency" | "stale" | "unknown-outcome";
  message: string;
};

export function sameHiredServiceEvidence(left: AdminHiredServiceEvidence, right: AdminHiredServiceEvidence) {
  return left.id === right.id && left.completed === right.completed;
}

export function searchAndPaginateHiredServices(
  hiredServices: readonly AdminHiredService[],
  params: AdminHiredServiceListParams,
  nameOf: (hiredService: AdminHiredService) => string,
): AdminHiredServiceListResult {
  const needle = params.keyword?.trim().toLocaleLowerCase();
  const filtered = needle
    ? hiredServices.filter((hiredService) => nameOf(hiredService).toLocaleLowerCase().includes(needle))
    : hiredServices;
  const start = (params.pageIndex - 1) * params.pageSize;
  return {
    pageIndex: params.pageIndex,
    pageSize: params.pageSize,
    totalRow: filtered.length,
    keywords: params.keyword ?? null,
    scope: "client-fallback",
    data: filtered.slice(start, start + params.pageSize),
  };
}

/**
 * Applies the Active/Completed quick filter to rows already on the current
 * page only. It never changes `totalRow`/pagination math, because the
 * underlying list read has no server-side status filter to re-query against
 * — filtering here would silently misrepresent how many records match.
 */
export function filterCurrentPageByStatus(
  hiredServices: readonly AdminHiredService[],
  status: StatusFilter,
): readonly AdminHiredService[] {
  if (status === "all") return hiredServices;
  return hiredServices.filter((hiredService) => (status === "completed" ? hiredService.completed : !hiredService.completed));
}
