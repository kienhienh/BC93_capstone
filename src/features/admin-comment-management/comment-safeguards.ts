import type { AdminComment, AdminCommentEvidence, AdminCommentListParams, AdminCommentListResult } from "./capability";

export type GuardFeedback = {
  state: "blocked-dependency" | "stale" | "unknown-outcome";
  message: string;
};

export function sameCommentEvidence(left: AdminCommentEvidence, right: AdminCommentEvidence) {
  return left.id === right.id && left.content === right.content && left.rating === right.rating;
}

export function searchAndPaginateComments(
  comments: readonly AdminComment[],
  params: AdminCommentListParams,
  nameOf: (comment: AdminComment) => string,
): AdminCommentListResult {
  const needle = params.keyword?.trim().toLocaleLowerCase();
  const filtered = needle
    ? comments.filter((comment) =>
      comment.content.toLocaleLowerCase().includes(needle) || nameOf(comment).toLocaleLowerCase().includes(needle))
    : comments;
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
