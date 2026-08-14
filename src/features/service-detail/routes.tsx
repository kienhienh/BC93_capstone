import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { reportAuthorizationFailure, useSession } from "../authentication/public";
import {
  clearCommentDraft,
  readCommentDraft,
  saveCommentDraft,
  useSubmitComment,
} from "../comment-submission/public";
import { CommentSubmissionFailure } from "../comment-submission/capability";
import type { ServiceComment } from "./capability";
import { useServiceComments, useServiceDetail } from "./controller";
import { ServiceDetailFailure } from "./capability";
import "./service-detail.css";

const commonServiceQuestions = [
  {
    question: "What should I review before hiring?",
    answer: "Review the Service description, taxonomy, package summary, price, and Seller information shown on this page.",
  },
  {
    question: "Where does the Service information come from?",
    answer: "The Service content and Seller summary are loaded from the marketplace Service record.",
  },
  {
    question: "How are Comments presented?",
    answer: "Comments are loaded separately from the Service and valid dates are shown newest first.",
  },
];

function commentsFailureMessage(error: unknown) {
  if (!(error instanceof ServiceDetailFailure)) {
    return "Comments are unavailable.";
  }
  switch (error.kind) {
    case "malformed":
      return "Comments returned an unsafe response.";
    case "offline":
      return "You are offline. Reconnect to load Comments.";
    case "network":
      return "We could not connect to load Comments.";
    case "server":
      return "Comments are temporarily unavailable.";
    default:
      return "Comments are unavailable.";
  }
}

function serviceFailureMessage(error: unknown) {
  if (!(error instanceof ServiceDetailFailure)) {
    return "Service could not be loaded safely.";
  }
  switch (error.kind) {
    case "malformed":
      return "Service returned an unsafe response.";
    case "offline":
      return "You are offline. Reconnect to load this Service.";
    case "network":
      return "We could not connect to load this Service.";
    case "server":
      return "Service is temporarily unavailable.";
    default:
      return "Service could not be loaded safely.";
  }
}

function ServicePageState({ title, children }: { title: string; children: ReactNode }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${title} | Fiverr Marketplace`;
    headingRef.current?.focus();
  }, [title]);
  return (
    <main id="main-content" className="service-detail-state">
      <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
      {children}
    </main>
  );
}

export function ServiceDetailRoute() {
  const { serviceId = "" } = useParams<{ serviceId: string }>();
  const { session } = useSession();
  const service = useServiceDetail(serviceId);
  const comments = useServiceComments(serviceId);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [commentReveal, setCommentReveal] = useState({ serviceId, count: 10 });
  const visibleComments = commentReveal.serviceId === serviceId ? commentReveal.count : 10;
  const orderedComments = useMemo(
    () => [...(comments.data ?? [])].sort((left, right) => {
      const leftTime = left.createdAt ? Date.parse(left.createdAt) : Number.NaN;
      const rightTime = right.createdAt ? Date.parse(right.createdAt) : Number.NaN;
      const safeLeft = Number.isFinite(leftTime) ? leftTime : Number.NEGATIVE_INFINITY;
      const safeRight = Number.isFinite(rightTime) ? rightTime : Number.NEGATIVE_INFINITY;
      return safeRight - safeLeft;
    }),
    [comments.data],
  );
  const commentRatingSummary = useMemo(() => {
    const ratings = (comments.data ?? [])
      .map((comment) => comment.rating)
      .filter((rating): rating is number => rating !== null);
    const counts = [5, 4, 3, 2, 1, 0].map((rating) => ({
      rating,
      count: ratings.filter((value) => Math.round(value) === rating).length,
    }));
    return {
      average: ratings.length > 0
        ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
        : null,
      counts,
      ratedCount: ratings.length,
    };
  }, [comments.data]);

  useEffect(() => {
    if (!service.data) return;
    document.title = `${service.data.title} | Fiverr Marketplace`;
    headingRef.current?.focus();
  }, [service.data]);

  if (service.isPending) {
    return <main id="main-content"><p role="status" aria-busy="true">Loading Service...</p></main>;
  }

  if (service.isError) {
    if (service.error instanceof ServiceDetailFailure && service.error.kind === "not_found") {
      return (
        <ServicePageState title="Service not found">
          <p>The requested Service does not exist.</p>
          <Link to="/services">Browse all Services</Link>
        </ServicePageState>
      );
    }
    return (
      <ServicePageState title="Service unavailable">
        <div role="alert">
          <p>{serviceFailureMessage(service.error)}</p>
          <button type="button" onClick={() => void service.refetch()}>
            Try loading Service again
          </button>
        </div>
      </ServicePageState>
    );
  }

  const detail = service.data;
  const breadcrumbItems = [detail.categoryName, detail.groupName, detail.subcategoryName].filter(
    (item): item is string => Boolean(item),
  );

  return (
    <main id="main-content" className="service-detail-page">
      {breadcrumbItems.length > 0 ? (
        <nav aria-label="Service breadcrumb">
          <ol>
            {breadcrumbItems.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </nav>
      ) : null}

      <div className="service-detail-layout">
        <article className="service-detail-content">
          <div className="service-detail-heading">
            <div>
              <p className="service-detail-eyebrow">Marketplace Service</p>
              <h1 ref={headingRef} tabIndex={-1}>{detail.title}</h1>
            </div>
            <button type="button" onClick={() => void service.refetch()}>
              <i className="bi bi-arrow-clockwise" aria-hidden="true" />
              Refresh Service details
            </button>
          </div>
          {service.isFetching ? (
            <p role="status" aria-label="Refreshing Service">Refreshing Service...</p>
          ) : null}
          <div className="service-owner-summary">
            {detail.seller?.avatarUrl ? (
              <img src={detail.seller.avatarUrl} alt="" width="32" height="32" />
            ) : (
              <span className="service-owner-avatar" aria-hidden="true">
                {(detail.seller?.name ?? "Marketplace Seller").charAt(0)}
              </span>
            )}
            <span className="service-owner-name">{detail.seller?.name ?? "Marketplace Seller"}</span>
            <span aria-hidden="true">•</span>
            <span className="service-rating">
              <i className="bi bi-star-fill" aria-hidden="true" />
              {detail.rating === null
                ? "Service rating unavailable"
                : `${detail.rating} out of 5 stars${detail.ratingCount === null ? "" : ` from ${detail.ratingCount} ratings`}`}
            </span>
          </div>
          {detail.imageUrl ? (
            <div className="service-detail-media">
              <img src={detail.imageUrl} alt={detail.title} width="900" height="560" />
            </div>
          ) : (
            <div className="service-detail-media service-detail-media-empty">
              <div role="img" aria-label={`Image unavailable for ${detail.title}`}>
                <i className="bi bi-image" aria-hidden="true" />
              </div>
            </div>
          )}

          <section className="service-about" aria-labelledby="service-about-heading">
            <h2 id="service-about-heading">About this Service</h2>
            <p>{detail.description}</p>
            {breadcrumbItems.length > 0 ? (
              <dl>
                {detail.categoryName ? <div><dt>Category</dt><dd>{detail.categoryName}</dd></div> : null}
                {detail.groupName ? <div><dt>Service group</dt><dd>{detail.groupName}</dd></div> : null}
                {detail.subcategoryName ? <div><dt>Specialty</dt><dd>{detail.subcategoryName}</dd></div> : null}
              </dl>
            ) : null}
          </section>

          <section className="service-seller" aria-label="About the Seller">
            <h2>About the Seller</h2>
            {detail.seller?.avatarUrl ? (
              <img
                src={detail.seller.avatarUrl}
                alt={detail.seller.name ?? "Seller"}
                width="64"
                height="64"
              />
            ) : (
              <span
                className="service-seller-avatar"
                role="img"
                aria-label={detail.seller?.name ?? "Marketplace Seller"}
              >
                {(detail.seller?.name ?? "Marketplace Seller").charAt(0)}
              </span>
            )}
            <div>
              <h3>{detail.seller?.name ?? "Marketplace Seller"}</h3>
              <p>Service owner</p>
            </div>
          </section>

          <section className="service-faq" aria-labelledby="service-faq-heading">
            <h2 id="service-faq-heading">Common Service questions</h2>
            <div>
              {commonServiceQuestions.map(({ question, answer }) => (
                <details key={question}>
                  <summary>{question}</summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </section>

        </article>

        <aside className="service-hire-card" aria-label="Hire this Service">
          <div className="service-hire-heading">
            <strong>Service package</strong>
            <p><strong>${detail.price}</strong></p>
          </div>
          <p className="service-hire-description">
            {detail.shortDescription ?? "Package details unavailable."}
          </p>
          <Link to={`/checkout/${encodeURIComponent(detail.id)}`}>
            Continue to Hire for ${detail.price}
          </Link>
          <p className="service-hire-note">
            <i className="bi bi-shield-check" aria-hidden="true" />
            Sign in is required before completing a Hire.
          </p>
        </aside>

        <section className="service-comments" aria-labelledby="comments-heading">
          <div className="service-comments-heading">
            <div>
              <h2 id="comments-heading">Comments</h2>
            </div>
            {!comments.isPending ? (
              <button type="button" onClick={() => void comments.refetch()}>
                <i className="bi bi-arrow-clockwise" aria-hidden="true" />
                Refresh Comments
              </button>
            ) : null}
          </div>
          {session ? (
            <CommentForm
              serviceId={serviceId}
              userId={session.user.id}
              sessionToken={session.token}
              refetchComments={comments.refetch}
            />
          ) : (
            <section className="service-comment-sign-in" aria-label="Add a Comment">
              <p>Sign in to rate this Service and add a Comment.</p>
              <Link to={`/login?returnTo=${encodeURIComponent(`/services/${serviceId}`)}`}>
                Add a Comment
              </Link>
            </section>
          )}
          {comments.isFetching && !comments.isPending ? (
            <p role="status" aria-label="Refreshing Comments">Refreshing Comments...</p>
          ) : null}
          {comments.isPending ? (
            <p role="status" aria-label="Loading Comments" aria-busy="true">Loading Comments...</p>
          ) : comments.isError ? (
            <div role="alert">
              <p>{commentsFailureMessage(comments.error)}</p>
              <button type="button" onClick={() => void comments.refetch()}>
                Try loading Comments again
              </button>
            </div>
          ) : comments.data.length === 0 ? (
            <p>No Comments have been posted yet.</p>
          ) : (
            <>
              <div className="service-review-summary" aria-label="Comment rating summary">
                <div className="service-review-score">
                  <strong>{comments.data.length} Comments</strong>
                  <p>
                    <i className="bi bi-star-fill" aria-hidden="true" />
                    {commentRatingSummary.average === null
                      ? "Average rating unavailable"
                      : `${commentRatingSummary.average.toFixed(1)} average rating`}
                  </p>
                  <span>Newest Comments appear first</span>
                </div>
                <div className="service-rating-breakdown">
                  {commentRatingSummary.counts.map(({ rating, count }) => (
                    <div key={rating}>
                      <span>{rating} stars</span>
                      <progress
                        aria-label={`${rating} stars: ${count} Comments`}
                        value={count}
                        max={Math.max(1, commentRatingSummary.ratedCount)}
                      />
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="service-comments-list">
                {orderedComments.slice(0, visibleComments).map((comment) => {
                  const authorName = comment.authorName ?? "Anonymous commenter";
                  const timestamp = comment.createdAt ? Date.parse(comment.createdAt) : Number.NaN;
                  const hasValidDate = Number.isFinite(timestamp);
                  return (
                    <article key={comment.id} className="service-comment">
                      {comment.avatarUrl ? (
                        <img src={comment.avatarUrl} alt={authorName} width="48" height="48" />
                      ) : (
                        <span className="service-comment-avatar" role="img" aria-label={authorName}>
                          {authorName.charAt(0).toUpperCase() || "?"}
                        </span>
                      )}
                      <div>
                        <h3>{authorName}</h3>
                        <p className="service-comment-rating">
                          <i className="bi bi-star-fill" aria-hidden="true" />
                          {comment.rating === null ? "Rating unavailable" : `${comment.rating} out of 5 stars`}
                        </p>
                        <p className="service-comment-date">
                          {hasValidDate ? (
                            <time dateTime={comment.createdAt ?? undefined}>
                              {new Intl.DateTimeFormat("en", {
                                dateStyle: "medium",
                                timeZone: "UTC",
                              }).format(timestamp)}
                            </time>
                          ) : "Date unavailable"}
                        </p>
                        <p className="service-comment-content">{comment.content.trim() || "Comment unavailable."}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
              {visibleComments < orderedComments.length ? (
                <button
                  type="button"
                  onClick={() => setCommentReveal({ serviceId, count: visibleComments + 10 })}
                >
                  Show {Math.min(10, orderedComments.length - visibleComments)} more Comments
                </button>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function CommentForm({
  serviceId,
  userId,
  sessionToken,
  refetchComments,
}: {
  serviceId: string;
  userId: string;
  sessionToken: string;
  refetchComments(): Promise<{ data?: ServiceComment[]; isError?: boolean }>;
}) {
  const [initialDraft] = useState(() => readCommentDraft(serviceId));
  const [rating, setRating] = useState<number | null>(initialDraft.rating);
  const [content, setContent] = useState(initialDraft.content);
  const [errors, setErrors] = useState<{ content?: string }>({});
  const [status, setStatus] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [retryKind, setRetryKind] = useState<"recoverable" | "unknown" | null>(null);
  const [pendingCheck, setPendingCheck] = useState<
    | { kind: "accepted"; commentId: string }
    | { kind: "unknown"; content: string; rating: number; createdAt: string }
    | null
  >(null);
  const [checkingComments, setCheckingComments] = useState(false);
  const contentInput = useRef<HTMLTextAreaElement>(null);
  const submission = useSubmitComment();
  const navigate = useNavigate();

  useEffect(() => {
    if (rating === null && content.length === 0) {
      clearCommentDraft(serviceId);
    } else {
      saveCommentDraft(serviceId, { rating, content });
    }
  }, [content, rating, serviceId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = {
      content:
        content.trim().length < 1 || content.length > 1000
          ? "Enter a Comment between 1 and 1000 characters."
          : undefined,
    };
    setErrors(nextErrors);
    if (nextErrors.content) {
      contentInput.current?.focus();
    } else {
      setStatus(null);
      setFailure(null);
      setRetryKind(null);
      const submittedContent = content.trim();
      const submittedRating = rating ?? 0;
      const createdAt = new Date(Date.now()).toISOString();
      let result;
      try {
        result = await submission.mutateAsync({
          serviceId,
          userId,
          sessionToken,
          rating: submittedRating,
          content: submittedContent,
          createdAt,
        });
      } catch (error) {
        if (error instanceof CommentSubmissionFailure && error.kind === "unauthorized") {
          saveCommentDraft(serviceId, { rating, content });
          reportAuthorizationFailure(401);
          navigate(`/login?returnTo=${encodeURIComponent(`/services/${serviceId}`)}`);
          return;
        }
        if (error instanceof CommentSubmissionFailure && error.kind === "forbidden") {
          saveCommentDraft(serviceId, { rating, content });
          reportAuthorizationFailure(403);
          return;
        }
        setFailure(
          error instanceof CommentSubmissionFailure
            ? error.kind === "server"
              ? "Comment submission is temporarily unavailable. Your draft is safe."
              : error.kind === "offline"
                ? "You are offline. Reconnect before trying again. Your draft is safe."
                : "We could not add your Comment. Your draft is safe."
            : "We could not add your Comment. Your draft is safe.",
        );
        setRetryKind("recoverable");
        return;
      }
      const refreshed = await refetchComments();
      if (refreshed.isError) {
        setFailure("We could not check whether your Comment was added. Check Comments before Retry.");
        setPendingCheck(
          result.kind === "accepted"
            ? { kind: "accepted", commentId: result.commentId }
            : { kind: "unknown", content: submittedContent, rating: submittedRating, createdAt },
        );
        return;
      }
      const observed = refreshed.data?.some((comment) =>
        result.kind === "accepted"
          ? comment.id === result.commentId
          : comment.content.trim() === submittedContent
            && comment.rating === submittedRating
            && comment.createdAt === createdAt);
      if (observed) {
        setRating(null);
        setContent("");
        clearCommentDraft(serviceId);
        setStatus("Your Comment was added.");
      } else if (result.kind === "unknown") {
        setFailure(
          "We could not confirm whether your Comment was added. The Comments were checked before Retry.",
        );
        setRetryKind("unknown");
      } else {
        setFailure("The server accepted your Comment, but it is not visible yet. Your draft is safe.");
        setPendingCheck({ kind: "accepted", commentId: result.commentId });
      }
    }
  }

  async function checkCommentsAgain() {
    if (!pendingCheck) return;
    setCheckingComments(true);
    const refreshed = await refetchComments();
    setCheckingComments(false);
    if (refreshed.isError) return;
    const observed = refreshed.data?.some((comment) =>
      pendingCheck.kind === "accepted"
        ? comment.id === pendingCheck.commentId
        : comment.content.trim() === pendingCheck.content
          && comment.rating === pendingCheck.rating
          && comment.createdAt === pendingCheck.createdAt);
    if (observed) {
      setPendingCheck(null);
      setFailure(null);
      setRating(null);
      setContent("");
      clearCommentDraft(serviceId);
      setStatus("Your Comment was added.");
    } else if (pendingCheck.kind === "unknown") {
      setPendingCheck(null);
      setFailure(
        "We could not confirm whether your Comment was added. The Comments were checked before Retry.",
      );
      setRetryKind("unknown");
    } else {
      setFailure("The server accepted your Comment, but it is not visible yet. Your draft is safe.");
    }
  }

  return (
    <form className="service-comment-form" aria-label="Add a Comment" onSubmit={handleSubmit} noValidate>
      <h3>Add a Comment</h3>
      <fieldset>
        <legend>Rating</legend>
        <div
          role="radiogroup"
          aria-label="Rating"
          aria-invalid={false}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className={rating !== null && value <= rating ? "is-filled" : undefined}>
              <input
                type="radio"
                name="comment-rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                disabled={submission.isPending || pendingCheck !== null}
                aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
              />
              <span aria-hidden="true">★</span>
            </label>
          ))}
        </div>
        <p className="service-rating-selection" aria-live="polite">
          {rating ?? 0} out of 5 stars selected
        </p>
        {rating !== null && rating > 0 ? (
          <button
            className="service-rating-clear"
            type="button"
            onClick={() => setRating(null)}
            disabled={submission.isPending || pendingCheck !== null}
          >
            Clear rating
          </button>
        ) : null}
      </fieldset>
      <label htmlFor="comment-content">Comment</label>
      <textarea
        ref={contentInput}
        id="comment-content"
        value={content}
        maxLength={1000}
        onChange={(event) => setContent(event.target.value)}
        disabled={submission.isPending || pendingCheck !== null}
        aria-invalid={Boolean(errors.content)}
        aria-describedby={errors.content ? "comment-content-error" : "comment-content-help"}
      />
      <p id="comment-content-help">{content.length}/1000 characters</p>
      {errors.content ? <p id="comment-content-error">{errors.content}</p> : null}
      {submission.isPending ? <p role="status" aria-live="polite">Submitting Comment...</p> : null}
      {!submission.isPending && status ? <p role="status" aria-live="polite">{status}</p> : null}
      {!submission.isPending && failure ? <p role="alert">{failure}</p> : null}
      {pendingCheck ? (
        <button type="button" disabled={checkingComments} onClick={() => void checkCommentsAgain()}>
          {checkingComments ? "Checking Comments..." : "Check Comments again"}
        </button>
      ) : null}
      <button type="submit" disabled={submission.isPending || pendingCheck !== null}>
        {submission.isPending
          ? "Submitting Comment..."
          : pendingCheck
            ? "Comment awaiting confirmation"
          : retryKind === "unknown"
            ? "Retry Comment"
            : retryKind === "recoverable"
              ? "Try adding Comment again"
            : "Add Comment"}
      </button>
    </form>
  );
}
