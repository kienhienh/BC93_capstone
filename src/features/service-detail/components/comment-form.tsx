import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { reportAuthorizationFailure } from "../../authentication/public";
import {
  clearCommentDraft,
  readCommentDraft,
  saveCommentDraft,
  useSubmitComment,
} from "../../comment-submission/public";
import { CommentSubmissionFailure } from "../../comment-submission/capability";
import type { ServiceComment } from "../capability";

export function CommentForm({
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
