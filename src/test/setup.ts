import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";
import { afterAll, afterEach, beforeAll, expect, vi } from "vitest";
import { resetTestApplications } from "./render-application";
import { resetTestData, server } from "./server";

expect.extend(toHaveNoViolations);

// Lazy-loaded routes (e.g. the Administrator bundle) can take longer than the
// default 1s under CPU-constrained CI runners; a larger async timeout keeps
// findBy*/waitFor assertions deterministic instead of flaking on slow machines.
configure({ asyncUtilTimeout: 5_000 });

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  cleanup();
  resetTestApplications();
  server.resetHandlers();
  resetTestData();
  localStorage.clear();
  sessionStorage.clear();
  document.title = "";
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

afterAll(() => server.close());
