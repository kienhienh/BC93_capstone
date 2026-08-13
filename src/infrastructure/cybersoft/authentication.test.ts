import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test/server";
import { createCybersoftAuthenticationCapability } from "./authentication";

describe("Cybersoft authentication adapter", () => {
  it("maps validated sign-in credentials to a password-free Session", async () => {
    let capturedBody: unknown;
    let capturedCybersoftToken: string | null = null;
    server.use(
      http.post("http://api.example.test/api/auth/signin", async ({ request }) => {
        capturedBody = await request.json();
        capturedCybersoftToken = request.headers.get("tokenCybersoft");
        return HttpResponse.json({
          content: {
            user: {
              id: 700,
              name: "Alex Morgan",
              email: "alex@example.com",
              password: "must-not-cross-the-boundary",
              avatar: null,
              role: "USER",
            },
            token: "header.payload.signature",
          },
        });
      }),
    );
    const capability = createCybersoftAuthenticationCapability({
      apiBaseUrl: "http://api.example.test/api",
      cybersoftToken: "deterministic-test-token",
    });

    const session = await capability.signIn({
      email: "alex@example.com",
      password: "secret1",
    });

    expect(capturedBody).toEqual({ email: "alex@example.com", password: "secret1" });
    expect(capturedCybersoftToken).toBe("deterministic-test-token");
    expect(session).toEqual({
      token: "header.payload.signature",
      user: {
        id: "700",
        name: "Alex Morgan",
        email: "alex@example.com",
        role: "USER",
        avatar: null,
      },
    });
    expect(session.user).not.toHaveProperty("password");
  });
});
