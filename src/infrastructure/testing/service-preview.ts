import type {
  ServicePreview,
  ServicePreviewCapability,
} from "../../features/service-preview/wiring";

export function createDeterministicServicePreviewCapability(
  services: readonly ServicePreview[] = [],
): ServicePreviewCapability {
  return {
    async listServices(signal) {
      if (signal.aborted) {
        throw new DOMException("The Service request was cancelled.", "AbortError");
      }

      return services.map((service) => ({ ...service }));
    },
  };
}
