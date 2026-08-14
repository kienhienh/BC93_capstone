import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../test/server";
import { createCybersoftCommentSubmissionCapability } from "./comment-submission";
import { CommentSubmissionFailure } from "../../features/comment-submission/capability";

const apiBaseUrl = "http://api.example.test/api";

describe("Cybersoft Comment Submission capability", () => {
  it("distinguishes offline failure from an online unknown network outcome", async () => {
    server.use(http.post(`${apiBaseUrl}/binh-luan`, () => HttpResponse.error()));
    const capability = createCybersoftCommentSubmissionCapability({
      apiBaseUrl,
      cybersoftToken: "private-test-token",
    });
    const input = {
      serviceId: "42",
      userId: "700",
      sessionToken: "session-token",
      rating: 4,
      content: "Network-aware Comment.",
      createdAt: "2026-08-14T03:15:00.000Z",
    };

    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    await expect(capability.submitComment(input)).rejects.toMatchObject({
      kind: "offline",
    } satisfies Partial<CommentSubmissionFailure>);

    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
    await expect(capability.submitComment(input)).resolves.toEqual({ kind: "unknown" });
  });

  it.each([
    { status: 401, kind: "unauthorized" },
    { status: 403, kind: "forbidden" },
  ] as const)("maps $status to $kind without exposing transport data", async ({ status, kind }) => {
    server.use(
      http.post(`${apiBaseUrl}/binh-luan`, () =>
        HttpResponse.json({ message: "private transport detail" }, { status })),
    );
    const capability = createCybersoftCommentSubmissionCapability({
      apiBaseUrl,
      cybersoftToken: "private-test-token",
    });

    await expect(capability.submitComment({
      serviceId: "42",
      userId: "700",
      sessionToken: "session-token",
      rating: 4,
      content: "Keep this safe.",
      createdAt: "2026-08-14T03:15:00.000Z",
    })).rejects.toMatchObject({ kind } satisfies Partial<CommentSubmissionFailure>);
  });

  it("returns an unknown outcome for an unconfirmable successful response", async () => {
    server.use(
      http.post(`${apiBaseUrl}/binh-luan`, () =>
        HttpResponse.json({ content: { unexpected: true } }, { status: 201 })),
    );
    const capability = createCybersoftCommentSubmissionCapability({
      apiBaseUrl,
      cybersoftToken: "private-test-token",
    });

    await expect(capability.submitComment({
      serviceId: "42",
      userId: "700",
      sessionToken: "session-token",
      rating: 4,
      content: "Please reconcile this.",
      createdAt: "2026-08-14T03:15:00.000Z",
    })).resolves.toEqual({ kind: "unknown" });
  });

  it("submits canonical Comment identity, Service, rating, content, and controlled UTC time", async () => {
    let receivedBody: unknown;
    let receivedSessionToken: string | null = null;
    let receivedCybersoftToken: string | null = null;
    server.use(
      http.post(`${apiBaseUrl}/binh-luan`, async ({ request }) => {
        receivedBody = await request.json();
        receivedSessionToken = request.headers.get("token");
        receivedCybersoftToken = request.headers.get("tokenCybersoft");
        return HttpResponse.json({
          content: {
            id: 901,
            maCongViec: 42,
            maNguoiBinhLuan: 700,
            ngayBinhLuan: "2026-08-14T03:15:00.000Z",
            noiDung: "Clear and helpful delivery.",
            saoBinhLuan: 5,
          },
        }, { status: 201 });
      }),
    );
    const capability = createCybersoftCommentSubmissionCapability({
      apiBaseUrl,
      cybersoftToken: "private-test-token",
    });

    const result = await capability.submitComment({
      serviceId: "42",
      userId: "700",
      sessionToken: "session-token",
      rating: 5,
      content: "Clear and helpful delivery.",
      createdAt: "2026-08-14T03:15:00.000Z",
    }, new AbortController().signal);

    expect(receivedSessionToken).toBe("session-token");
    expect(receivedCybersoftToken).toBe("private-test-token");
    expect(receivedBody).toEqual({
      maCongViec: 42,
      maNguoiBinhLuan: 700,
      ngayBinhLuan: "2026-08-14T03:15:00.000Z",
      noiDung: "Clear and helpful delivery.",
      saoBinhLuan: 5,
    });
    expect(result).toEqual({ kind: "accepted", commentId: "901" });
  });
});
