import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "../../test/server";
import { createCybersoftProfileCapability } from "./profile";

const apiBaseUrl = "http://api.example.test/api";
const userUrl = `${apiBaseUrl}/users/700`;
const avatarUrl = `${apiBaseUrl}/users/upload-avatar`;
const dto = { id: 700, name: "Alex Morgan", email: "alex@example.com", phone: "+84901234567", birthday: "1995-04-18", avatar: null, gender: true, role: "USER", skill: ["React"], certification: ["WCAG"] };
const capability = () => createCybersoftProfileCapability({ apiBaseUrl, cybersoftToken: "cybersoft-token" });

describe("Cybersoft Profile adapter", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("fetches only the Session User with both authentication headers", async () => {
    let headers: Headers | undefined;
    server.use(http.get(userUrl, ({ request }) => { headers = request.headers; return HttpResponse.json({ content: dto }); }));
    await expect(capability().getProfile("700", "session-token")).resolves.toMatchObject({ id: "700", name: "Alex Morgan", skills: ["React"] });
    expect(headers?.get("token")).toBe("session-token"); expect(headers?.get("tokenCybersoft")).toBe("cybersoft-token");
  });

  it("sends the protected identity unchanged and only applies safe Profile changes", async () => {
    let body: unknown; let headers: Headers | undefined;
    server.use(http.put(userUrl, async ({ request }) => { headers = request.headers; body = await request.json(); return HttpResponse.json({ content: { ...dto, name: "Alex Updated" } }); }));
    const current = await capability().updateProfile({ id: "700", name: "Alex Morgan", email: "alex@example.com", phone: "+84901234567", birthday: "1995-04-18", avatar: null, gender: true, role: "USER", skills: ["React"], certifications: ["WCAG"] }, { name: "Alex Updated", phone: "+84909999999", birthday: "1995-04-18", gender: false, skills: ["React", "Vue"], certifications: ["WCAG"] }, "session-token");
    expect(current.name).toBe("Alex Updated"); expect(headers?.get("content-type")).toContain("application/json");
    expect(body).toEqual({ id: 700, name: "Alex Updated", email: "alex@example.com", phone: "+84909999999", birthday: "1995-04-18", avatar: null, gender: false, role: "USER", skill: ["React", "Vue"], certification: ["WCAG"] });
    expect(body).not.toHaveProperty("password");
  });

  it("uploads the selected image through multipart form data", async () => {
    let target: RequestInfo | URL | undefined; let options: RequestInit | undefined;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => { target = input; options = init; return new Response(JSON.stringify({ content: { ...dto, avatar: "https://images.example.test/avatar.webp" } }), { status: 200, headers: { "Content-Type": "application/json" } }); }));
    await expect(capability().uploadAvatar("700", new File(["image"], "avatar.webp", { type: "image/webp" }), "session-token")).resolves.toMatchObject({ avatar: "https://images.example.test/avatar.webp" });
    expect(target).toBe(avatarUrl); expect(options?.method).toBe("POST"); expect(options?.headers).toMatchObject({ token: "session-token", tokenCybersoft: "cybersoft-token" }); expect(options?.headers).not.toHaveProperty("Content-Type"); expect((options?.body as FormData).get("formFile")).toBeInstanceOf(File); expect(((options?.body as FormData).get("formFile") as File).name).toBe("avatar.webp");
  });

  it("preserves authorization and malformed response outcomes", async () => {
    server.use(http.get(userUrl, () => HttpResponse.json({ message: "Unauthorized" }, { status: 401 })));
    await expect(capability().getProfile("700", "expired")).rejects.toMatchObject({ kind: "unauthorized" });
    server.use(http.get(userUrl, () => HttpResponse.json({ content: { id: 700, name: "Unsafe" } })));
    await expect(capability().getProfile("700", "session-token")).rejects.toMatchObject({ kind: "malformed" });
  });

  it("treats a successful but malformed update response as an unknown mutation outcome", async () => {
    server.use(http.put(userUrl, () => HttpResponse.json({ content: { unexpected: true } })));
    await expect(capability().updateProfile({ id: "700", name: "Alex Morgan", email: "alex@example.com", phone: "+84901234567", birthday: "1995-04-18", avatar: null, gender: true, role: "USER", skills: [], certifications: [] }, { name: "Alex Updated", phone: "+84901234567", birthday: "1995-04-18", gender: true, skills: [], certifications: [] }, "session-token")).rejects.toMatchObject({ kind: "unknown" });
  });
});
