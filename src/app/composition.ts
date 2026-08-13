import { QueryClient } from "@tanstack/react-query";
import { createCybersoftServicePreviewCapability } from "../infrastructure/cybersoft/service-preview";
import { createDeterministicServicePreviewCapability } from "../infrastructure/testing/service-preview";
import type { ServicePreviewCapability } from "../features/service-preview/wiring";
import type { AuthenticationCapability, SessionStore } from "../features/authentication/wiring";
import { createCybersoftAuthenticationCapability } from "../infrastructure/cybersoft/authentication";
import { createBrowserSessionStore } from "../infrastructure/browser/session-store";
import { readRuntimeConfig, type RuntimeConfigResult } from "./runtime-config";

export type ApplicationComposition =
  | {
      ok: true;
      queryClient: QueryClient;
      servicePreview: ServicePreviewCapability;
      authentication: AuthenticationCapability;
      sessionStore: SessionStore;
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
      authentication: createUnavailableAuthenticationCapability(),
      sessionStore: createBrowserSessionStore(),
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
    authentication: createCybersoftAuthenticationCapability(configResult.config),
    sessionStore: createBrowserSessionStore(),
  };
}

function createUnavailableAuthenticationCapability(): AuthenticationCapability {
  return {
    register: async () => {
      throw new Error("Authentication is unavailable in this composition.");
    },
    signIn: async () => {
      throw new Error("Authentication is unavailable in this composition.");
    },
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
