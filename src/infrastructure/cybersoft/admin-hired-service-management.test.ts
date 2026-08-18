import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../test/server";
import { createCybersoftAdminHiredServiceManagementCapability } from "./admin-hired-service-management";

const apiBaseUrl = "http://api.example.test/api";
const hiredServicesUrl = `${apiBaseUrl}/thue-cong-viec`;
const hiredServiceUrl = (id: string) => `${hiredServicesUrl}/${id}`;
const servicesUrl = `${apiBaseUrl}/cong-viec`;
const usersUrl = `${apiBaseUrl}/users`;

const hiredOne = { id: 4848, maCongViec: 9, maNguoiThue: 2661, ngayThue: "8/11/2023", hoanThanh: true };
const hiredTwo = { id: 5153, maCongViec: 32, maNguoiThue: 0, ngayThue: "16/9/2023", hoanThanh: false };

const capability = () => createCybersoftAdminHiredServiceManagementCapability({ apiBaseUrl, cybersoftToken: "cybersoft-token" });

describe("Cybersoft Admin Hired Service Management adapter", () => {
  it("loads the complete Hired Service snapshot with both auth headers, tolerating junk rows", async () => {
    let headers: Headers | undefined;
    server.use(http.get(hiredServicesUrl, ({ request }) => {
      headers = request.headers;
      return HttpResponse.json({ content: [hiredOne, hiredTwo] });
    }));
    const result = await capability().listAllHiredServices("session-token");
    expect(result).toEqual([
      { id: "4848", serviceId: "9", clientId: "2661", hiredAt: "8/11/2023", completed: true },
      { id: "5153", serviceId: "32", clientId: "0", hiredAt: "16/9/2023", completed: false },
    ]);
    expect(headers?.get("token")).toBe("session-token");
    expect(headers?.get("tokenCybersoft")).toBe("cybersoft-token");
  });

  it("refetches fresh evidence for one Hired Service by re-reading the complete snapshot, since there is no id-scoped GET", async () => {
    server.use(http.get(hiredServicesUrl, () => HttpResponse.json({ content: [hiredOne, hiredTwo] })));
    await expect(capability().refetchHiredServiceEvidence("4848", "session-token")).resolves.toEqual({ id: "4848", completed: true });
    await expect(capability().refetchHiredServiceEvidence("999999", "session-token")).resolves.toBeNull();
  });

  it("loads Service (with seller id and current price) and User lookup lists, discarding every other User field", async () => {
    server.use(
      http.get(servicesUrl, () => HttpResponse.json({ content: [{ id: 9, tenCongViec: "Logo Design", giaTien: 22, nguoiTao: 1 }] })),
      http.get(usersUrl, () => HttpResponse.json({ content: [{ id: 1, name: "Ada", password: "secret", role: "USER" }] })),
    );
    await expect(capability().listAllServices("session-token")).resolves.toEqual([
      { id: "9", title: "Logo Design", price: 22, sellerId: "1" },
    ]);
    const users = await capability().listAllUsers("session-token");
    expect(users).toEqual([{ id: "1", name: "Ada" }]);
    expect(JSON.stringify(users)).not.toContain("secret");
  });

  it("completes and cancels only the addressed Hired Service, sending the minimal expected body", async () => {
    const bodies: unknown[] = [];
    let deleteUrl: URL | undefined;
    server.use(
      http.put(hiredServiceUrl("4848"), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ content: null });
      }),
      http.delete(hiredServiceUrl("4848"), ({ request }) => {
        deleteUrl = new URL(request.url);
        return HttpResponse.json({ content: null });
      }),
    );
    const api = capability();
    await api.completeHiredService("4848", "session-token");
    await api.cancelHiredService("4848", "session-token");
    expect(bodies).toEqual([{ hoanThanh: true }]);
    expect(deleteUrl?.pathname).toBe("/api/thue-cong-viec/4848");
  });

  it("maps server validation and ambiguous transport outcomes distinctly for mutations", async () => {
    server.use(http.put(hiredServiceUrl("1"), () => HttpResponse.json({ message: "invalid" }, { status: 400 })));
    await expect(capability().completeHiredService("1", "session-token")).rejects.toMatchObject({ kind: "validation" });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("socket reset")));
    await expect(capability().cancelHiredService("1", "session-token")).rejects.toMatchObject({ kind: "unknown_outcome" });
    vi.unstubAllGlobals();
  });
});
