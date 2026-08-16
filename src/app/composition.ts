import { QueryClient } from "@tanstack/react-query";
import { createCybersoftServicePreviewCapability } from "../infrastructure/cybersoft/service-preview";
import { createDeterministicServicePreviewCapability } from "../infrastructure/testing/service-preview";
import type { ServicePreviewCapability } from "../features/service-preview/wiring";
import type { AuthenticationCapability, SessionStore } from "../features/authentication/wiring";
import { createCybersoftAuthenticationCapability } from "../infrastructure/cybersoft/authentication";
import { createBrowserSessionStore } from "../infrastructure/browser/session-store";
import { createCybersoftTaxonomyCapability } from "../infrastructure/cybersoft/taxonomy";
import type { TaxonomyCapability } from "../features/taxonomy/wiring";
import { readRuntimeConfig, type RuntimeConfig } from "./runtime-config";
import { createCybersoftServiceDiscoveryCapability } from "../infrastructure/cybersoft/service-discovery";
import type { ServiceDiscoveryCapability } from "../features/service-discovery/wiring";
import type { ServiceDetailCapability } from "../features/service-detail/wiring";
import { createCybersoftServiceDetailCapability } from "../infrastructure/cybersoft/service-detail";
import type { CommentSubmissionCapability } from "../features/comment-submission/wiring";
import { createCybersoftCommentSubmissionCapability } from "../infrastructure/cybersoft/comment-submission";
import type { HireConfirmationCapability } from "../features/hire-confirmation/wiring";
import { createCybersoftHireConfirmationCapability } from "../infrastructure/cybersoft/hire-confirmation";
import type { ProfileCapability } from "../features/profile/wiring";
import { createCybersoftProfileCapability } from "../infrastructure/cybersoft/profile";

export type ApplicationComposition =
  | {
      ok: true;
      queryClient: QueryClient;
      servicePreview: ServicePreviewCapability;
      authentication: AuthenticationCapability;
      sessionStore: SessionStore;
      taxonomy: TaxonomyCapability;
      serviceDiscovery: ServiceDiscoveryCapability;
      serviceDetail: ServiceDetailCapability;
      commentSubmission: CommentSubmissionCapability;
      hireConfirmation: HireConfirmationCapability;
      profile: ProfileCapability;
      runtimeConfig: RuntimeConfig;
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
      taxonomy: createUnavailableTaxonomyCapability(),
      serviceDiscovery: createUnavailableServiceDiscoveryCapability(),
      serviceDetail: createUnavailableServiceDetailCapability(),
      commentSubmission: createUnavailableCommentSubmissionCapability(),
      hireConfirmation: createUnavailableHireConfirmationCapability(),
      profile: createUnavailableProfileCapability(),
      runtimeConfig: {
        apiBaseUrl: "http://api.example.test/api",
        cybersoftToken: "deterministic-test-token",
      },
    };
  }

  const configResult = readRuntimeConfig(environment);

  if (configResult.ok === false) {
    return { ok: false, message: configResult.message };
  }

  return {
    ok: true,
    queryClient: createQueryClient(),
    servicePreview: createCybersoftServicePreviewCapability(configResult.config),
    authentication: createCybersoftAuthenticationCapability(configResult.config),
    sessionStore: createBrowserSessionStore(),
    taxonomy: createCybersoftTaxonomyCapability(configResult.config),
    serviceDiscovery: createCybersoftServiceDiscoveryCapability(configResult.config),
    serviceDetail: createCybersoftServiceDetailCapability(configResult.config),
    commentSubmission: createCybersoftCommentSubmissionCapability(configResult.config),
    hireConfirmation: createCybersoftHireConfirmationCapability(configResult.config),
    profile: createCybersoftProfileCapability(configResult.config),
    runtimeConfig: configResult.config,
  };
}

function createUnavailableProfileCapability(): ProfileCapability {
  return { getProfile: async () => { throw new Error("Profile is unavailable."); }, updateProfile: async () => { throw new Error("Profile is unavailable."); }, uploadAvatar: async () => { throw new Error("Profile is unavailable."); } };
}

function createUnavailableHireConfirmationCapability(): HireConfirmationCapability {
  return {
    getService: async () => { throw new Error("Hire Confirmation is unavailable."); },
    createHire: async () => { throw new Error("Hire Confirmation is unavailable."); },
    listHiredServices: async () => [],
    getHiredService: async () => { throw new Error("Hire Confirmation is unavailable."); },
    completeHire: async () => { throw new Error("Hire Confirmation is unavailable."); },
    cancelHire: async () => { throw new Error("Hire Confirmation is unavailable."); },
  };
}

function createUnavailableCommentSubmissionCapability(): CommentSubmissionCapability {
  return {
    submitComment: async () => {
      throw new Error("Comment Submission is unavailable.");
    },
  };
}

function createUnavailableServiceDetailCapability(): ServiceDetailCapability {
  return {
    getService: async () => { throw new Error("Service Detail is unavailable."); },
    listComments: async () => [],
  };
}

function createUnavailableServiceDiscoveryCapability(): ServiceDiscoveryCapability {
  return { listServices: async () => [], searchServices: async () => [], listServicesBySubcategory: async () => [] };
}

function createUnavailableTaxonomyCapability(): TaxonomyCapability {
  return { listCategories: async () => [], getCategory: async () => null };
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
