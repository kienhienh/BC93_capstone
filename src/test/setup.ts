import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { resetTestApplications } from "./render-application";
import { resetTestData, server } from "./server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  cleanup();
  resetTestApplications();
  server.resetHandlers();
  resetTestData();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

afterAll(() => server.close());
