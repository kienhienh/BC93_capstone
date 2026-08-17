import type { FailureKind } from "../route-utils";
import type { GuardFeedback } from "../comment-safeguards";

export function FailureMessage({ kind, action, onRetry }: { kind: FailureKind; action: string; onRetry?: () => void }) {
  const messages: Record<FailureKind, string> = {
    cancelled: "The request was cancelled.",
    malformed: "The server returned an invalid response.",
    offline: `You are offline. Cannot ${action}.`,
    network: "Network error. Please try again.",
    server: "Server error. Please try again later.",
    not_found: "Not found.",
    forbidden: "Access forbidden.",
    unauthorized: "Your session is not authorized for this action.",
    validation: "The server rejected this request.",
    unknown_outcome: "The mutation outcome is unknown and must be reconciled before retrying.",
    unknown: "An unexpected error occurred. Please try again.",
  };
  const recoverable = ["malformed", "offline", "network", "server", "unknown"].includes(kind);
  return <div className="state-indicator" data-state={kind.replaceAll("_", "-")} role="alert">
    <span>{messages[kind]}</span>
    {recoverable && onRetry ? <button type="button" className="state-retry" onClick={onRetry}>Try again</button> : null}
  </div>;
}

export function GuardMessage({ feedback, onReload, onReconcile }: {
  feedback: GuardFeedback;
  onReload?: () => void;
  onReconcile?: () => void;
}) {
  return <div className="state-indicator" data-state={feedback.state} role="alert">
    <span>{feedback.message}</span>
    {feedback.state === "stale" && onReload ? <button type="button" className="state-retry" onClick={onReload}>Reload latest</button> : null}
    {feedback.state === "unknown-outcome" && onReconcile ? <button type="button" className="state-retry" onClick={onReconcile}>Check latest</button> : null}
  </div>;
}
