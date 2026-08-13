import { z } from "zod";

const runtimeConfigSchema = z.object({
  VITE_API_BASE_URL: z
    .url()
    .refine((value) => value.startsWith("https://") || value.startsWith("http://")),
  VITE_CYBERSOFT_TOKEN: z.string().trim().min(1),
});

export interface RuntimeConfig {
  apiBaseUrl: string;
  cybersoftToken: string;
}

export type RuntimeConfigResult =
  | { ok: true; config: RuntimeConfig }
  | { ok: false; message: string };

export function readRuntimeConfig(environment: Record<string, unknown>): RuntimeConfigResult {
  const result = runtimeConfigSchema.safeParse(environment);

  if (!result.success) {
    return {
      ok: false,
      message:
        "Application configuration is unavailable. Set a valid API URL and Cybersoft token, then restart the application.",
    };
  }

  return {
    ok: true,
    config: {
      apiBaseUrl: result.data.VITE_API_BASE_URL.replace(/\/+$/, ""),
      cybersoftToken: result.data.VITE_CYBERSOFT_TOKEN,
    },
  };
}
