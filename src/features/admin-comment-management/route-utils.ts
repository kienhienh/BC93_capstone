import { AdminCommentManagementFailure } from "./capability";

export const VALID_PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;
export type FailureKind = AdminCommentManagementFailure["kind"] | "unknown";

export function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return value && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function pageSizeFrom(value: string | null) {
  const parsed = Number(value);
  return VALID_PAGE_SIZES.some((size) => size === parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

export function kindOf(error: unknown): FailureKind {
  return error instanceof AdminCommentManagementFailure ? error.kind : "unknown";
}

export function listPath(search: string) {
  return `/admin/comments${search}`;
}

export function withSearch(path: string, search: string) {
  return `${path}${search}`;
}
