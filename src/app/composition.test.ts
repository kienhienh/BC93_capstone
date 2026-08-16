import { describe, expect, it } from "vitest";
import { composeApplication } from "./composition";

describe("Application Composition", () => {
  it("exposes validated runtime configuration for the lazy Administrator boundary", () => {
    const result = composeApplication({
      mode: "production",
      environment: {
        MODE: "production",
        VITE_API_BASE_URL: "http://api.example.test",
        VITE_CYBERSOFT_TOKEN: "cybersoft-token",
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.runtimeConfig).toEqual({
        apiBaseUrl: "http://api.example.test",
        cybersoftToken: "cybersoft-token",
      });
    }
  });

  it("uses deterministic runtime configuration in test mode", () => {
    const result = composeApplication({ mode: "test", environment: {} });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.runtimeConfig.apiBaseUrl).toBe("http://api.example.test/api");
      expect(result.runtimeConfig.cybersoftToken).toBe("deterministic-test-token");
    }
  });
});
