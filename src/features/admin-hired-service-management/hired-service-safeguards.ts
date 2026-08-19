import type {
  AdminHiredService,
  AdminHiredServiceEvidence,
  AdminHiredServiceListParams,
  AdminHiredServiceListResult,
} from "./capability";

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
  const byKeyword = needle
    ? hiredServices.filter((hiredService) => nameOf(hiredService).toLocaleLowerCase().includes(needle))
    : hiredServices;
  const status = params.status ?? "all";
  const filtered = status === "all"
    ? byKeyword
    : byKeyword.filter((hiredService) => (status === "completed" ? hiredService.completed : !hiredService.completed));
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
