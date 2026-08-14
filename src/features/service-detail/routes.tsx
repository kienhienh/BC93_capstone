import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useServiceComments, useServiceDetail } from "./controller";
import { ServiceDetailFailure } from "./capability";
import "./service-detail.css";

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
        <article>
          <h1 ref={headingRef} tabIndex={-1}>{detail.title}</h1>
          <button type="button" onClick={() => void service.refetch()}>
            Refresh Service details
          </button>
          {service.isFetching ? (
            <p role="status" aria-label="Refreshing Service">Refreshing Service...</p>
          ) : null}
          {detail.imageUrl ? (
            <img src={detail.imageUrl} alt={detail.title} width="900" height="560" />
          ) : (
            <div role="img" aria-label={`Image unavailable for ${detail.title}`}>
              <i className="bi bi-image" aria-hidden="true" />
            </div>
          )}
          <p>
            {detail.rating === null
              ? "Service rating unavailable"
              : `${detail.rating} out of 5 stars${detail.ratingCount === null ? "" : ` from ${detail.ratingCount} ratings`}`}
          </p>
          <p>{detail.description}</p>

          <section aria-label="About the Seller">
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
            <p>{detail.seller?.name ?? "Marketplace Seller"}</p>
          </section>

        </article>

        <aside aria-label="Hire this Service">
          <p><strong>${detail.price}</strong></p>
          <Link to={`/checkout/${encodeURIComponent(detail.id)}`}>
            Continue to Hire for ${detail.price}
          </Link>
        </aside>

        <section className="service-comments" aria-labelledby="comments-heading">
          <h2 id="comments-heading">Comments</h2>
          {!comments.isPending ? (
            <button type="button" onClick={() => void comments.refetch()}>
              Refresh Comments
            </button>
          ) : null}
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
                        <p>{comment.rating === null ? "Rating unavailable" : `${comment.rating} out of 5 stars`}</p>
                        <p>
                          {hasValidDate ? (
                            <time dateTime={comment.createdAt ?? undefined}>
                              {new Intl.DateTimeFormat("en", {
                                dateStyle: "medium",
                                timeZone: "UTC",
                              }).format(timestamp)}
                            </time>
                          ) : "Date unavailable"}
                        </p>
                        <p>{comment.content.trim() || "Comment unavailable."}</p>
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
