import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../test/server";
import { createCybersoftAdminCommentManagementCapability } from "./admin-comment-management";

const apiBaseUrl = "http://api.example.test/api";
const commentsUrl = `${apiBaseUrl}/binh-luan`;
const commentUrl = (id: string) => `${commentsUrl}/${id}`;
const byServiceUrl = (id: string) => `${commentsUrl}/lay-binh-luan-theo-cong-viec/${id}`;
const servicesUrl = `${apiBaseUrl}/cong-viec`;
const usersUrl = `${apiBaseUrl}/users`;

const commentOne = { id: 100, maCongViec: 1, maNguoiBinhLuan: 5, ngayBinhLuan: "2025-01-01", noiDung: "Great work", saoBinhLuan: 5 };
const commentTwo = { id: 101, maCongViec: 2, maNguoiBinhLuan: 6, ngayBinhLuan: "string", noiDung: "ok", saoBinhLuan: 0 };

const capability = () => createCybersoftAdminCommentManagementCapability({ apiBaseUrl, cybersoftToken: "cybersoft-token" });

describe("Cybersoft Admin Comment Management adapter", () => {
  it("loads the complete Comment snapshot with both auth headers, tolerating junk/placeholder rows", async () => {
    let headers: Headers | undefined;
    server.use(http.get(commentsUrl, ({ request }) => {
      headers = request.headers;
      return HttpResponse.json({ content: [commentOne, commentTwo] });
    }));
    const result = await capability().listAllComments("session-token");
    expect(result).toEqual([
      { id: "100", serviceId: "1", authorId: "5", content: "Great work", rating: 5, createdAt: "2025-01-01" },
      { id: "101", serviceId: "2", authorId: "6", content: "ok", rating: 0, createdAt: "string" },
    ]);
    expect(headers?.get("token")).toBe("session-token");
    expect(headers?.get("tokenCybersoft")).toBe("cybersoft-token");
  });

  it("refetches fresh evidence for one Comment through the per-Service read, without needing an id-scoped GET", async () => {
    server.use(http.get(byServiceUrl("1"), () => HttpResponse.json({ content: [
      { id: 100, ngayBinhLuan: "2025-01-01", noiDung: "Great work", saoBinhLuan: 5, tenNguoiBinhLuan: "Ada", avatar: null },
    ] })));
    await expect(capability().refetchCommentEvidence("1", "100", "session-token")).resolves.toEqual({
      id: "100",
      content: "Great work",
      rating: 5,
    });
    await expect(capability().refetchCommentEvidence("1", "999", "session-token")).resolves.toBeNull();
  });

  it("loads Service and Author lookup lists and discards every other User field", async () => {
    server.use(
      http.get(servicesUrl, () => HttpResponse.json({ content: [{ id: 1, tenCongViec: "Logo Design" }] })),
      http.get(usersUrl, () => HttpResponse.json({ content: [{ id: 5, name: "Ada", password: "secret", role: "USER" }] })),
    );
    await expect(capability().listAllServices("session-token")).resolves.toEqual([{ id: "1", title: "Logo Design" }]);
    const authors = await capability().listAllAuthors("session-token");
    expect(authors).toEqual([{ id: "5", name: "Ada" }]);
    expect(JSON.stringify(authors)).not.toContain("secret");
  });

  it("creates, updates, and deletes only the Comment resource, preserving the caller's fields on update without trusting an unverified PUT response", async () => {
    const bodies: unknown[] = [];
    let deleteUrl: URL | undefined;
    server.use(
      http.post(commentsUrl, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ content: { id: 102, maCongViec: 1, maNguoiBinhLuan: 5, ngayBinhLuan: "2025-02-02", noiDung: "New", saoBinhLuan: 4 } });
      }),
      http.put(commentUrl("102"), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ content: "unverified shape, ignored" });
      }),
      http.delete(commentUrl("102"), ({ request }) => {
        deleteUrl = new URL(request.url);
        return HttpResponse.json({ content: null });
      }),
    );
    const api = capability();
    await expect(api.createComment(
      { serviceId: "1", authorId: "5", content: "New", rating: 4, createdAt: "2025-02-02" },
      "session-token",
    )).resolves.toEqual({ id: "102", serviceId: "1", authorId: "5", content: "New", rating: 4, createdAt: "2025-02-02" });

    await expect(api.updateComment(
      "102",
      { serviceId: "1", authorId: "5", createdAt: "2025-02-02", content: "Edited", rating: 3 },
      "session-token",
    )).resolves.toEqual({ id: "102", serviceId: "1", authorId: "5", content: "Edited", rating: 3, createdAt: "2025-02-02" });

    await api.deleteComment("102", "session-token");
    expect(bodies).toEqual([
      { maCongViec: 1, maNguoiBinhLuan: 5, ngayBinhLuan: "2025-02-02", noiDung: "New", saoBinhLuan: 4 },
      { id: 102, maCongViec: 1, maNguoiBinhLuan: 5, ngayBinhLuan: "2025-02-02", noiDung: "Edited", saoBinhLuan: 3 },
    ]);
    expect(deleteUrl?.pathname).toBe("/api/binh-luan/102");
  });

  it("maps server validation and ambiguous transport outcomes distinctly", async () => {
    server.use(http.post(commentsUrl, () => HttpResponse.json({ message: "invalid" }, { status: 400 })));
    await expect(capability().createComment(
      { serviceId: "1", authorId: "5", content: "x", rating: 5, createdAt: "2025-01-01" },
      "session-token",
    )).rejects.toMatchObject({ kind: "validation" });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("socket reset")));
    await expect(capability().updateComment(
      "1",
      { serviceId: "1", authorId: "5", createdAt: "2025-01-01", content: "x", rating: 5 },
      "session-token",
    )).rejects.toMatchObject({ kind: "unknown_outcome" });
    vi.unstubAllGlobals();
  });
});
