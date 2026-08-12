import { QueryClient } from "@tanstack/react-query";
import { createCybersoftServicePreviewCapability } from "../infrastructure/cybersoft/service-preview";
import { createDeterministicServicePreviewCapability } from "../infrastructure/testing/service-preview";
import type { ServicePreviewCapability } from "../features/service-preview/wiring";
import { readRuntimeConfig, type RuntimeConfigResult } from "./runtime-config";

export type ApplicationComposition =
  | {
      ok: true;
      queryClient: QueryClient;
      servicePreview: ServicePreviewCapability;
    }
  | { ok: false; message: string };

export function composeApplication({
  mode,
  environment,
}: {
  mode: "production" | "test";
  environment: Record<string, unknown>;
}): ApplicationComposition {
  if (mode === "test") {
    return {
      ok: true,
      queryClient: createQueryClient(),
      servicePreview: createDeterministicServicePreviewCapability(),
    };
  }

  const configResult: RuntimeConfigResult = readRuntimeConfig(environment);

  if (!configResult.ok) {
    return configResult;
  }

  return {
    ok: true,
    queryClient: createQueryClient(),
    servicePreview: createCybersoftServicePreviewCapability(configResult.config),
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}
