export interface CommentDraft {
  rating: number | null;
  content: string;
}

const keyFor = (serviceId: string) => `service-comment-draft:${serviceId}`;

export function readCommentDraft(serviceId: string): CommentDraft {
  try {
    const raw = sessionStorage.getItem(keyFor(serviceId));
    if (!raw) return { rating: null, content: "" };
    const value = JSON.parse(raw) as { rating?: unknown; content?: unknown };
    const rating = typeof value.rating === "number"
      && Number.isInteger(value.rating)
      && value.rating >= 0
      && value.rating <= 5
      ? value.rating
      : null;
    const content = typeof value.content === "string"
      ? value.content.slice(0, 1000)
      : "";
    return { rating, content };
  } catch {
    return { rating: null, content: "" };
  }
}

export function saveCommentDraft(serviceId: string, draft: CommentDraft) {
  sessionStorage.setItem(keyFor(serviceId), JSON.stringify(draft));
}

export function clearCommentDraft(serviceId: string) {
  sessionStorage.removeItem(keyFor(serviceId));
}
