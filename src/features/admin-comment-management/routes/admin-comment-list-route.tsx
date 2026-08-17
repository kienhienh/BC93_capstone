import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { DeleteCommentControl } from "../components/delete-comment-control";
import { FailureMessage } from "../components/feedback";
import { useAdminAllComments, useAdminCommentAuthors, useAdminCommentServices } from "../controller";
import { searchAndPaginateComments } from "../comment-safeguards";
import { VALID_PAGE_SIZES, kindOf, pageSizeFrom, positiveInteger, withSearch } from "../route-utils";

export function AdminCommentListRoute() {
  const { session } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation() as ReturnType<typeof useLocation> & { state?: { adminFeedback?: string } | null };
  const heading = useRef<HTMLHeadingElement>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const q = searchParams.get("q") ?? "";
  const page = positiveInteger(searchParams.get("page"), 1);
  const pageSize = pageSizeFrom(searchParams.get("pageSize"));
  const commentsQuery = useAdminAllComments(session?.token ?? "");
  const servicesQuery = useAdminCommentServices(session?.token ?? "");
  const authorsQuery = useAdminCommentAuthors(session?.token ?? "");

  useEffect(() => {
    document.title = "Comment Management | Administrator";
    heading.current?.focus();
  }, []);

  const serviceTitleOf = (id: string) => servicesQuery.data?.find((service) => service.id === id)?.title ?? `Service #${id}`;
  const authorNameOf = (id: string) => authorsQuery.data?.find((author) => author.id === id)?.name ?? `User #${id}`;

  const result = commentsQuery.data
    ? searchAndPaginateComments(commentsQuery.data, { pageIndex: page, pageSize, keyword: q || undefined },
      (comment) => `${authorNameOf(comment.authorId)} ${serviceTitleOf(comment.serviceId)}`)
    : null;
  const totalPages = result ? Math.max(1, Math.ceil(result.totalRow / pageSize)) : 1;

  useEffect(() => {
    const canonical = new URLSearchParams();
    if (q) canonical.set("q", q);
    canonical.set("page", String(result ? Math.min(page, totalPages) : page));
    canonical.set("pageSize", String(pageSize));
    if (canonical.toString() !== searchParams.toString()) setSearchParams(canonical, { replace: true });
  }, [result, page, pageSize, q, searchParams, setSearchParams, totalPages]);

  const setListState = (next: { q: string; page: number; pageSize: number }, replace = false) => {
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    params.set("page", String(next.page));
    params.set("pageSize", String(next.pageSize));
    setSearchParams(params, { replace });
  };

  const listState = commentsQuery.isPending ? "loading" : commentsQuery.isError ? kindOf(commentsQuery.error)
    : result?.data.length === 0 && q ? "query-empty"
      : result?.data.length === 0 ? "empty" : "confirmed-success";
  const partialRelationFailure = Boolean(commentsQuery.data) && (servicesQuery.isError || authorsQuery.isError);

  return <main id="main-content" className="admin-comment-list">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
      <Link to="/admin">Overview</Link><span aria-hidden="true">/</span><span aria-current="page">Comments</span>
    </nav>
    <header className="admin-page-heading admin-comment-heading-row">
      <div><span className="admin-eyebrow">Marketplace moderation</span><h1 ref={heading} tabIndex={-1}>Comment Management</h1>
        <p>Review, create, edit, and delete Comments across every Service.</p></div>
      <Link to={withSearch("/admin/comments/new", location.search)} className="button admin-primary-action"><span aria-hidden="true">+</span> Create Comment</Link>
    </header>

    <p className="admin-comment-list-scope" data-scope="client-fallback">
      The Comment API does not support server-side search or pagination; this list is filtered and paginated from the complete Comment snapshot.
    </p>

    {commentsQuery.isPending ? <div className="state-indicator" data-state="loading" role="status">Loading Comments...</div> : null}
    {commentsQuery.isRefetching && !commentsQuery.isPending ? <div className="state-indicator" data-state="refreshing" role="status">Refreshing Comments...</div> : null}
    {commentsQuery.isError ? <FailureMessage kind={kindOf(commentsQuery.error)} action="load" onRetry={() => void commentsQuery.refetch()} /> : null}
    {partialRelationFailure ? <div className="state-indicator" data-state="partial-relation-failure" role="status">
      <span>Some Service or User names could not be loaded. Comments below may show numeric identifiers instead of names.</span>
      <button type="button" className="state-retry" onClick={() => { void servicesQuery.refetch(); void authorsQuery.refetch(); }}>Try relations again</button>
    </div> : null}
    {listState === "empty" ? <div className="state-indicator" data-state="empty" role="status">No Comments found.</div> : null}
    {listState === "query-empty" ? <div className="state-indicator" data-state="query-empty" role="status">No Comments match your search for “{q}”.</div> : null}
    {location.state?.adminFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{location.state.adminFeedback}</div> : null}
    {deleteFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{deleteFeedback}</div> : null}

    <div className="admin-comment-list-controls">
      <div><label htmlFor="comment-search">Search Comments</label>
        <input id="comment-search" type="search" value={q} placeholder="Search by content, author, or Service..." aria-label="Search Comments by content, author, or Service"
          onChange={(event) => setListState({ q: event.target.value, page: 1, pageSize }, true)} /></div>
      <div><label htmlFor="comment-page-size">Page size</label>
        <select id="comment-page-size" value={pageSize} onChange={(event) => setListState({ q, page: 1, pageSize: Number(event.target.value) })}>
          {VALID_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} per page</option>)}
        </select></div>
      <div className="admin-comment-refresh"><span className="control-label" aria-hidden="true">Data</span>
        <button type="button" onClick={() => void commentsQuery.refetch()} disabled={commentsQuery.isPending || commentsQuery.isRefetching}>
          {commentsQuery.isRefetching ? "Refreshing..." : "Refresh Comments"}</button></div>
    </div>

    {listState === "confirmed-success" && result ? <div className="admin-comment-table">
      <table role="grid" aria-label="Comment list">
        <thead><tr><th scope="col">Comment</th><th scope="col">Author</th><th scope="col">Service</th><th scope="col">Rating</th><th scope="col">Actions</th></tr></thead>
        <tbody>{result.data.map((comment) => <tr key={comment.id}>
          <td data-label="Comment">{comment.content}</td>
          <td data-label="Author">{authorNameOf(comment.authorId)}</td>
          <td data-label="Service">{serviceTitleOf(comment.serviceId)}</td>
          <td data-label="Rating">{comment.rating ?? "—"}</td>
          <td data-label="Actions"><div className="row-actions">
            <Link aria-label={`View Comment ${comment.id}`} to={withSearch(`/admin/comments/${comment.id}`, location.search)}>View</Link>
            <Link aria-label={`Edit Comment ${comment.id}`} to={withSearch(`/admin/comments/${comment.id}/edit`, location.search)}>Edit</Link>
            <DeleteCommentControl comment={comment} visibleLabel="Delete" className="link-button danger-link"
              onReloadLatest={() => void commentsQuery.refetch()} onDeleted={() => {
                setDeleteFeedback(`Comment ${comment.id} deleted successfully.`);
                if (result.data.length === 1 && page > 1) setListState({ q, page: page - 1, pageSize }, true);
                else void commentsQuery.refetch();
              }} />
          </div></td>
        </tr>)}</tbody>
      </table>
    </div> : null}

    {listState === "confirmed-success" && result && totalPages > 1 ? <nav className="pagination" aria-label="Pagination">
      <button type="button" onClick={() => setListState({ q, page: page - 1, pageSize })} disabled={page <= 1}>Previous</button>
      <span>Page {page} of {totalPages} (Total: {result.totalRow} Comments)</span>
      <button type="button" onClick={() => setListState({ q, page: page + 1, pageSize })} disabled={page >= totalPages}>Next</button>
    </nav> : null}
  </main>;
}
