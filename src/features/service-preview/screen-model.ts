import { ServicePreviewFailure, type ServicePreview } from "./capability";
import { useServicePreview } from "./controller";

const previewLimit = 6;

export type ServicePreviewScreenItem = Readonly<ServicePreview>;

export interface ServicePreviewScreenModel {
  services: readonly ServicePreviewScreenItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  canRefresh: boolean;
  isEmpty: boolean;
  errorMessage: string | null;
  refresh(): void;
}

function failureMessage(error: unknown): string {
  if (!(error instanceof ServicePreviewFailure)) {
    return "Services could not be loaded safely. Please try again.";
  }

  switch (error.kind) {
    case "malformed":
      return "The Services response was not in a safe format. Please try again later.";
    case "offline":
      return "You are offline. Reconnect to load Services.";
    case "network":
      return "We could not connect to the Service marketplace. Check your connection and try again.";
    case "server":
      return "Services are temporarily unavailable. Please try again.";
    default:
      return "Services could not be loaded safely. Please try again.";
  }
}

export function useServicePreviewScreenModel(): ServicePreviewScreenModel {
  const query = useServicePreview();
  const services = query.data?.slice(0, previewLimit) ?? [];

  return {
    services,
    isLoading: query.isPending,
    isRefreshing: query.isFetching && !query.isPending,
    canRefresh: query.data !== undefined,
    isEmpty: query.isSuccess && services.length === 0,
    errorMessage: query.isError ? failureMessage(query.error) : null,
    refresh: () => {
      void query.refetch();
    },
  };
}
