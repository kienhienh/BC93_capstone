import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test/server";
import { createCybersoftServicePreviewCapability } from "./service-preview";

describe("Cybersoft Service preview boundary", () => {
  it("accepts cancellation without exposing a raw transport error", async () => {
    server.use(
      http.get("http://api.example.test/api/cong-viec", async () => {
        await delay("infinite");
        return HttpResponse.json({ content: [] });
      }),
    );
    const capability = createCybersoftServicePreviewCapability({
      apiBaseUrl: "http://api.example.test/api",
      cybersoftToken: "deterministic-test-token",
    });
    const controller = new AbortController();
    const request = capability.listServices(controller.signal);

    controller.abort();

    await expect(request).rejects.toMatchObject({
      name: "ServicePreviewFailure",
      kind: "cancelled",
    });
  });
});
