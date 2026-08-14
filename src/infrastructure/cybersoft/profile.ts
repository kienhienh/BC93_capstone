import { z } from "zod";
import { ProfileFailure, type EditableProfile, type Profile, type ProfileCapability } from "../../features/profile/capability";

const id = z.union([z.string(), z.number()]);
const list = z.union([z.array(z.string()), z.string(), z.null(), z.undefined()]).transform((value) => {
  if (Array.isArray(value)) return value;
  if (!value || value === "null") return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [value]; } catch { return [value]; }
});
const user = z.object({ id, name: z.string(), email: z.string().email(), phone: z.string().nullable().optional(), birthday: z.string().nullable().optional(), avatar: z.string().nullable().optional(), gender: z.boolean().nullable().optional(), role: z.string().nullable().optional(), skill: list, certification: list });
const responseSchema = z.object({ content: user });

function map(value: z.infer<typeof user>): Profile { return { id: String(value.id), name: value.name, email: value.email, phone: value.phone ?? "", birthday: value.birthday?.slice(0, 10) ?? "", avatar: value.avatar ?? null, gender: value.gender ?? true, role: value.role ?? "USER", skills: value.skill, certifications: value.certification }; }
function numeric(value: string) { const result = Number(value); if (!Number.isSafeInteger(result)) throw new ProfileFailure("malformed"); return result; }
function failure(status: number) { if (status === 401) return new ProfileFailure("unauthorized"); if (status === 403) return new ProfileFailure("forbidden"); if (status === 404) return new ProfileFailure("not_found"); return new ProfileFailure(status >= 500 ? "server" : "unknown"); }
async function parse(response: Response) { if (!response.ok) throw failure(response.status); const parsed = responseSchema.safeParse(await response.json().catch(() => null)); if (!parsed.success) throw new ProfileFailure("malformed"); return map(parsed.data.content); }
function transport(error: unknown, signal?: AbortSignal) { if (error instanceof ProfileFailure) return error; if (signal?.aborted) return new ProfileFailure("cancelled"); if (typeof navigator !== "undefined" && !navigator.onLine) return new ProfileFailure("offline"); if (error instanceof TypeError) return new ProfileFailure("network"); return new ProfileFailure("unknown"); }

export function createCybersoftProfileCapability(config: { apiBaseUrl: string; cybersoftToken: string }): ProfileCapability {
  const headers = { tokenCybersoft: config.cybersoftToken };
  return {
    async getProfile(userId, sessionToken, signal) { try { return await parse(await fetch(`${config.apiBaseUrl}/users/${encodeURIComponent(userId)}`, { signal, headers: { ...headers, token: sessionToken } })); } catch (error) { throw transport(error, signal); } },
    async updateProfile(profile, changes: EditableProfile, sessionToken, signal) { try { return await parse(await fetch(`${config.apiBaseUrl}/users/${encodeURIComponent(profile.id)}`, { method: "PUT", signal, headers: { "Content-Type": "application/json", ...headers, token: sessionToken }, body: JSON.stringify({ id: numeric(profile.id), name: changes.name, email: profile.email, phone: changes.phone, birthday: changes.birthday, avatar: profile.avatar, gender: changes.gender, role: profile.role, skill: changes.skills, certification: changes.certifications }) })); } catch (error) { if (error instanceof ProfileFailure && error.kind === "malformed") throw new ProfileFailure("unknown"); throw transport(error, signal); } },
    async uploadAvatar(_userId, file, sessionToken, signal) { try { const body = new FormData(); body.append("formFile", file); return await parse(await fetch(`${config.apiBaseUrl}/users/upload-avatar`, { method: "POST", signal, headers: { ...headers, token: sessionToken }, body })); } catch (error) { if (error instanceof ProfileFailure && error.kind === "malformed") throw new ProfileFailure("unknown"); throw transport(error, signal); } },
  };
}
