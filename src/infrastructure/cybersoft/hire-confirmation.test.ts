import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { HireFailure } from "../../features/hire-confirmation/capability";
import { server } from "../../test/server";
import { createCybersoftHireConfirmationCapability } from "./hire-confirmation";

const apiBaseUrl = "http://api.example.test/api";
const hireUrl = `${apiBaseUrl}/thue-cong-viec`;
const hiredServicesUrl = `${apiBaseUrl}/thue-cong-viec/lay-danh-sach-da-thue`;

function createCapability() {
  return createCybersoftHireConfirmationCapability({
    apiBaseUrl,
    cybersoftToken: "private-test-token",
  });
}

describe("Cybersoft Hire confirmation capability", () => {
  it("sends the authenticated Cybersoft Hire contract and maps the accepted Hire ID", async () => {
    let requestBody: unknown;
    let headers: Headers | undefined;
    server.use(http.post(hireUrl, async ({ request }) => {
      headers = request.headers;
      requestBody = await request.json();
      return HttpResponse.json({ content: { id: 901 } }, { status: 201 });
    }));

    await expect(createCapability().createHire({
      serviceId: "42",
      userId: "700",
      sessionToken: "session-token",
      hiredAt: "2026-08-14T08:15:00.000Z",
    })).resolves.toEqual({ kind: "accepted", hireId: "901" });

    expect(headers?.get("content-type")).toContain("application/json");
    expect(headers?.get("token")).toBe("session-token");
    expect(headers?.get("tokenCybersoft")).toBe("private-test-token");
    expect(requestBody).toEqual({
      id: 0,
      maCongViec: 42,
      maNguoiThue: 700,
      ngayThue: "2026-08-14T08:15:00.000Z",
      hoanThanh: false,
    });
  });

  it("requests and maps the authenticated Hired Services reconciliation list, stamping the caller's own userId", async () => {
    let headers: Headers | undefined;
    server.use(http.get(hiredServicesUrl, ({ request }) => {
      headers = request.headers;
      return HttpResponse.json({
        content: [{
          id: 901,
          ngayThue: "2026-08-14T08:15:00.000Z",
          hoanThanh: false,
          congViec: { id: 42, tenCongViec: "Accessible marketplace design", giaTien: 220, nguoiTao: 810 },
        }],
      });
    }));

    await expect(createCapability().listHiredServices("session-token", "700")).resolves.toEqual([{
      id: "901",
      serviceId: "42",
      userId: "700",
      hiredAt: "2026-08-14T08:15:00.000Z",
      completed: false,
      service: { title: "Accessible marketplace design", price: 220 },
      seller: null,
    }]);
    expect(headers?.get("token")).toBe("session-token");
    expect(headers?.get("tokenCybersoft")).toBe("private-test-token");
  });

  it("treats a successful but unrecognized POST response as ambiguous for reconciliation", async () => {
    server.use(http.post(hireUrl, () =>
      HttpResponse.json({ content: { unexpected: true } }, { status: 201 }),
    ));

    await expect(createCapability().createHire({
      serviceId: "42",
      userId: "700",
      sessionToken: "session-token",
      hiredAt: "2026-08-14T08:15:00.000Z",
    })).resolves.toEqual({ kind: "unknown" });
  });

  it("rejects malformed reconciliation data and preserves authorization outcomes", async () => {
    server.use(
      http.get(hiredServicesUrl, () => HttpResponse.json({ content: "unsafe" })),
      http.post(hireUrl, () => HttpResponse.json({ message: "Unauthorized" }, { status: 401 })),
    );
    const capability = createCapability();

    await expect(capability.listHiredServices("session-token", "700")).rejects.toMatchObject({
      kind: "malformed",
    } satisfies Partial<HireFailure>);
    await expect(capability.createHire({
      serviceId: "42",
      userId: "700",
      sessionToken: "session-token",
      hiredAt: "2026-08-14T08:15:00.000Z",
    })).rejects.toMatchObject({
      kind: "unauthorized",
    } satisfies Partial<HireFailure>);
  });
});
