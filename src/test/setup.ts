import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";
import { afterAll, afterEach, beforeAll, expect, vi } from "vitest";
import { resetTestApplications } from "./render-application";
import { resetTestData, server } from "./server";

expect.extend(toHaveNoViolations);

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
