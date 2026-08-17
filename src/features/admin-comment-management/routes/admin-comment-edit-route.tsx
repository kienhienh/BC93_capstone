import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../../authentication/public";
import { CommentForm } from "../components/comment-form";
import { DeleteCommentControl } from "../components/delete-comment-control";
import { FailureMessage, GuardMessage } from "../components/feedback";
import { sameCommentEvidence, type GuardFeedback } from "../comment-safeguards";
import { useAdminAllComments, useAdminCommentAuthors, useAdminCommentSafeguardEvidence, useAdminCommentServices, useUpdateAdminComment } from "../controller";
import { kindOf, listPath, withSearch } from "../route-utils";
import type { AdminComment } from "../capability";

export function AdminCommentEditRoute() {
  const { commentId = "" } = useParams();
  const { session } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const commentsQuery = useAdminAllComments(session?.token ?? "");
  const servicesQuery = useAdminCommentServices(session?.token ?? "");
  const authorsQuery = useAdminCommentAuthors(session?.token ?? "");
  const mutation = useUpdateAdminComment(session?.token ?? "");
  const evidence = useAdminCommentSafeguardEvidence(session?.token ?? "");
  const [baselineOverride, setBaselineOverride] = useState<AdminComment | null>(null);
  const [feedback, setFeedback] = useState<GuardFeedback | null>(null);
  const [formKey, setFormKey] = useState(0);
  const back = listPath(location.search);

  useEffect(() => {
    document.title = "Edit Comment | Administrator";
    heading.current?.focus();
  }, []);

  const baseline = baselineOverride ?? commentsQuery.data?.find((item) => item.id === commentId) ?? null;
  const notFound = Boolean(commentsQuery.data) && !baselineOverride && !commentsQuery.data?.some((item) => item.id === commentId);
  const serviceTitle = baseline ? servicesQuery.data?.find((service) => service.id === baseline.serviceId)?.title ?? `Service #${baseline.serviceId}` : null;
  const authorName = baseline ? authorsQuery.data?.find((author) => author.id === baseline.authorId)?.name ?? `User #${baseline.authorId}` : null;

  const reloadLatest = async () => {
    setFeedback(null);
    const result = await commentsQuery.refetch();
    const refreshed = result.data?.find((item) => item.id === commentId) ?? null;
    setBaselineOverride(refreshed);
    setFormKey((value) => value + 1);
  };

  const reconcileUpdate = async (target: { content: string; rating: number } | null = null) => {
    if (!baseline || !target) return;
    try {
      const current = await evidence.refetchEvidence(baseline.serviceId, baseline.id);
      if (current && current.content === target.content && current.rating === target.rating) {
        navigate(withSearch(`/admin/comments/${baseline.id}`, location.search), {
          replace: true,
          state: { adminFeedback: `Comment ${baseline.id} update was confirmed after reconciliation.` },
        });
        return;
      }
      setFeedback({ state: "unknown-outcome", message: "Update was not confirmed. The latest Comment does not yet match; no automatic retry was sent." });
    } catch {
      setFeedback({ state: "unknown-outcome", message: "Update outcome is still unknown because the latest Comment could not be checked. No update retry was sent." });
    }
  };

  const save = async (content: string, rating: number) => {
    if (!baseline) return false;
    setFeedback(null);

    let current;
    try {
      current = await evidence.refetchEvidence(baseline.serviceId, baseline.id);
    } catch {
      setFeedback({ state: "blocked-dependency", message: "Update is blocked until the latest Comment can be verified." });
      return false;
    }
    if (!current) {
      setFeedback({ state: "stale", message: "This Comment no longer exists. Reload latest before editing." });
      return false;
    }
    if (!sameCommentEvidence(current, baseline)) {
      setFeedback({ state: "stale", message: "This Comment changed after you opened the form. Reload latest before saving." });
      return false;
    }

    try {
      await mutation.mutateAsync({
        id: baseline.id,
        input: { serviceId: baseline.serviceId, authorId: baseline.authorId, createdAt: baseline.createdAt, content, rating },
      });
      navigate(withSearch(`/admin/comments/${baseline.id}`, location.search), {
        replace: true,
        state: { adminFeedback: `Comment ${baseline.id} updated successfully.` },
      });
      return true;
    } catch (error) {
      if (kindOf(error) === "unknown_outcome") await reconcileUpdate({ content, rating });
      return false;
    }
  };

  return <main id="main-content" className="admin-comment-edit">
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link to="/admin">Overview</Link><span aria-hidden="true">/</span><Link to={back}>Comments</Link><span aria-hidden="true">/</span><span aria-current="page">Edit</span></nav>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">Moderation maintenance</span><h1 ref={heading} tabIndex={-1}>Edit Comment</h1><p>Change only the content and rating. Author and date are preserved.</p></div></header>

    {commentsQuery.isPending ? <div className="state-indicator" data-state="loading" role="status">Loading Comment...</div> : null}
    {commentsQuery.isError ? <FailureMessage kind={kindOf(commentsQuery.error)} action="load" onRetry={() => void commentsQuery.refetch()} /> : null}
    {notFound ? <div className="state-indicator" data-state="not-found" role="alert">Comment not found.</div> : null}
    {mutation.isPending ? <div className="state-indicator" data-state="pending" role="status">Updating Comment...</div> : null}
    {mutation.isError && kindOf(mutation.error) !== "unknown_outcome" ? <FailureMessage kind={kindOf(mutation.error)} action="update" /> : null}
    {feedback ? <GuardMessage feedback={feedback}
      onReload={feedback.state === "stale" ? () => void reloadLatest() : undefined}
      onReconcile={feedback.state === "unknown-outcome" ? () => void reconcileUpdate() : undefined} /> : null}

    {baseline ? <>
      <dl className="admin-comment-meta">
        <div><dt>Author</dt><dd>{authorName}</dd></div>
        <div><dt>Service</dt><dd>{serviceTitle}</dd></div>
        <div><dt>Date</dt><dd>{baseline.createdAt ?? "—"}</dd></div>
      </dl>
      <CommentForm key={`${baseline.id}-${formKey}`} idPrefix="edit-comment" pending={mutation.isPending} submitLabel="Save Changes" cancelTo={back}
        initialContent={baseline.content} initialRating={baseline.rating ?? 0} serverError={null} onClearServerError={() => undefined} onSubmit={save} />
      <div className="admin-category-destructive-actions" aria-label="Edit Comment destructive actions">
        <DeleteCommentControl comment={baseline} visibleLabel="Delete Comment" className="danger-button"
          onReloadLatest={() => void reloadLatest()}
          onDeleted={() => navigate(back, { replace: true, state: { adminFeedback: `Comment ${baseline.id} deleted successfully.` } })} />
      </div>
    </> : null}
  </main>;
}
