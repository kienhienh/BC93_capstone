import { QueryClient } from "@tanstack/react-query";
import { createCybersoftServicePreviewCapability } from "../infrastructure/cybersoft/service-preview";
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
  const configResult: RuntimeConfigResult =
    mode === "test"
      ? {
          ok: true,
          config: {
            apiBaseUrl: "http://api.example.test/api",
            cybersoftToken: "deterministic-test-token",
          },
        }
      : readRuntimeConfig(environment);

  if (!configResult.ok) {
    return configResult;
  }

  return {
    ok: true,
    queryClient: new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    }),
    servicePreview: createCybersoftServicePreviewCapability(configResult.config),
  };
}
