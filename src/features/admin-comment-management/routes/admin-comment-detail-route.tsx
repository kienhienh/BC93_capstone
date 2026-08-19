import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { DeleteCommentControl } from "../components/delete-comment-control";
import { FailureMessage } from "../components/feedback";
import { useAdminAllComments, useAdminCommentAuthors, useAdminCommentServices } from "../controller";
import { kindOf, listPath, withSearch } from "../route-utils";

export function AdminCommentDetailRoute() {
  const { commentId = "" } = useParams();
  const { session } = useSession();
  const location = useLocation() as ReturnType<typeof useLocation> & { state?: { adminFeedback?: string } | null };
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const commentsQuery = useAdminAllComments(session?.token ?? "");
  const servicesQuery = useAdminCommentServices(session?.token ?? "");
  const authorsQuery = useAdminCommentAuthors(session?.token ?? "");
  const back = listPath(location.search);

  useEffect(() => {
    document.title = "Comment Detail | Administrator";
    heading.current?.focus();
  }, []);

  const comment = commentsQuery.data?.find((item) => item.id === commentId) ?? null;
  const notFound = Boolean(commentsQuery.data) && !comment;
  const serviceTitle = comment ? servicesQuery.data?.find((service) => service.id === comment.serviceId)?.title ?? `Service #${comment.serviceId}` : null;
  const authorName = comment ? authorsQuery.data?.find((author) => author.id === comment.authorId)?.name ?? `User #${comment.authorId}` : null;
  const partialRelationFailure = Boolean(comment) && (servicesQuery.isError || authorsQuery.isError);

  return <main id="main-content" className="admin-comment-detail">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to={back}>Comments</Link><span aria-hidden="true">/</span><span aria-current="page">Detail</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">Moderation record</span><h1 ref={heading} tabIndex={-1}>Comment Detail</h1><p>Review the Comment, its author, and the Service it targets.</p></div></header>

    {location.state?.adminFeedback ? <div className="state-indicator" data-state="confirmed-success" role="status">{location.state.adminFeedback}</div> : null}
    {commentsQuery.isPending ? <div className="state-indicator" data-state="loading" role="status">Loading Comment...</div> : null}
    {commentsQuery.isRefetching && !commentsQuery.isPending ? <div className="state-indicator" data-state="refreshing" role="status">Refreshing Comment...</div> : null}
    {commentsQuery.isError ? <FailureMessage kind={kindOf(commentsQuery.error)} action="load" onRetry={() => void commentsQuery.refetch()} /> : null}
    {notFound ? <div className="state-indicator" data-state="not-found" role="alert">Comment not found.</div> : null}
    {partialRelationFailure ? <div className="state-indicator" data-state="partial-relation-failure" role="status">
      <span>Some Service or User names could not be loaded. This Comment may show numeric identifiers instead of names.</span>
    </div> : null}

    {comment ? <>
      <section className="admin-comment-detail-card" aria-labelledby="comment-record-title">
        <span className="admin-eyebrow">Comment</span><h2 id="comment-record-title">Comment {comment.id}</h2>
        <p>{comment.content}</p>
        <dl className="admin-comment-meta">
          <div><dt>Author</dt><dd>{authorName}</dd></div>
          <div><dt>Service</dt><dd>{serviceTitle}</dd></div>
          <div><dt>Rating</dt><dd>{comment.rating ?? "—"}</dd></div>
          <div><dt>Date</dt><dd>{comment.createdAt ?? "—"}</dd></div>
        </dl>
      </section>

      <nav className="detail-actions" aria-label="Comment detail actions">
        <Link to={back}>Back to list</Link>
        <Link to={withSearch(`/admin/comments/${comment.id}/edit`, location.search)}>Edit Comment</Link>
        <DeleteCommentControl comment={comment} visibleLabel="Delete Comment" className="danger-button"
          onReloadLatest={() => void commentsQuery.refetch()}
          onDeleted={() => navigate(back, { replace: true, state: { adminFeedback: `Comment ${comment.id} deleted successfully.` } })} />
      </nav>
    </> : null}
  </main>;
}
