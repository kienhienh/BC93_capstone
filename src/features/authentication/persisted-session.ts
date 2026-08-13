import { z } from "zod";
import type { AuthenticatedSession } from "./capability";

const persistedSessionSchema = z
  .object({
    token: z.string().min(1),
    user: z.object({
      id: z.string().min(1),
      name: z.string(),
      email: z.email(),
      role: z.string().nullable(),
      avatar: z.string().nullable(),
    }).strict(),
  })
  .strict();

export function restoreSession(value: unknown, now = Date.now()): AuthenticatedSession | null {
  const parsed = persistedSessionSchema.safeParse(value);
  if (!parsed.success) return null;
  const expiresAt = readTokenExpiration(parsed.data.token);
  return expiresAt !== null && expiresAt > now ? parsed.data : null;
}

export function readTokenExpiration(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload: unknown = JSON.parse(atob(padded));
    const result = z.object({ exp: z.number().finite().positive() }).safeParse(payload);
    return result.success ? result.data.exp * 1_000 : null;
  } catch {
    return null;
  }
}
