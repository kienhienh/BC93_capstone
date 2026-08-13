import { TaxonomyFailure } from "./capability";

export function taxonomyFailureMessage(error: unknown) {
  if (!(error instanceof TaxonomyFailure)) {
    return "Service Categories could not be loaded safely. Try again.";
  }
  switch (error.kind) {
    case "malformed":
      return "Service Categories returned an unsafe response. Try again later.";
    case "offline":
      return "You are offline. Reconnect to load Service Categories.";
    case "network":
      return "We could not connect to load Service Categories.";
    case "server":
      return "Service Categories are temporarily unavailable.";
    default:
      return "Service Categories could not be loaded safely. Try again.";
  }
}
