import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "../../test/server";
import { createCybersoftAdminUserManagementCapability } from "./admin-user-management";

const apiBaseUrl = "http://api.example.test/api";
const listUrl = `${apiBaseUrl}/users/phan-trang-tim-kiem`;
const usersUrl = `${apiBaseUrl}/users`;
const getUserUrl = (id: string) => `${apiBaseUrl}/users/${id}`;
const searchUserUrl = (name: string) => `${apiBaseUrl}/users/search/${name}`;

const userDto = {
  id: 1,
  name: "John Doe",
  email: "john@example.com",
  phone: "0123456789",
  birthday: "1990-01-01",
  avatar: null,
  gender: true,
  role: "USER",
  skill: ["React", "TypeScript"],
  certification: ["WCAG"],
};

const capability = () =>
  createCybersoftAdminUserManagementCapability({
    apiBaseUrl,
    cybersoftToken: "cybersoft-token",
  });

describe("Cybersoft Admin User Management adapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads the complete User resource snapshot", async () => {
    let headers: Headers | undefined;
    server.use(
      http.get(usersUrl, ({ request }) => {
        headers = request.headers;
        return HttpResponse.json({ content: [userDto, { ...userDto, id: 2, role: "admin" }] });
      }),
    );

    const result = await capability().listAllUsers("session-token");

    expect(result).toHaveLength(2);
    expect(result[1].role).toBe("admin");
    expect(headers?.get("token")).toBe("session-token");
    expect(headers?.get("tokenCybersoft")).toBe("cybersoft-token");
  });

  it("searches the User resource by the API name endpoint", async () => {
    let requestedUrl = "";
    server.use(
      http.get(searchUserUrl("Jane%20Admin"), ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json({ content: [{ ...userDto, id: 2, name: "Jane Admin" }] });
      }),
    );

    const result = await capability().searchUsersByName("Jane Admin", "session-token");

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Jane Admin");
    expect(decodeURIComponent(requestedUrl)).toContain("/users/search/Jane Admin");
  });

  it("keeps dirty legacy read data visible instead of failing the whole paginated list", async () => {
    server.use(
      http.get(listUrl, () => HttpResponse.json({
        content: {
          pageIndex: "1",
          pageSize: "10",
          totalRow: "2",
          data: [
            userDto,
            {
              ...userDto,
              id: 4,
              name: 12345,
              email: "not-an-email",
              phone: null,
              birthday: null,
              avatar: "",
              gender: "false",
              role: "seller",
              skill: "null",
              certification: "[\"Legacy Cert\"]",
            },
          ],
        },
      })),
    );

    const result = await capability().listUsers(
      { pageIndex: 1, pageSize: 10 },
      "session-token",
    );

    expect(result.pageIndex).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.totalRow).toBe(2);
    expect(result.keywords).toBeNull();
    expect(result.scope).toBe("server");
    expect(result.data[1]).toMatchObject({
      id: "4",
      name: "12345",
      email: "not-an-email",
      phone: "",
      birthday: "",
      avatar: null,
      gender: false,
      role: "seller",
      skills: [],
      certifications: ["Legacy Cert"],
    });
  });

  it("lists users with pagination parameters", async () => {
    let url: URL | undefined;
    server.use(
      http.get(listUrl, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json({
          content: {
            pageIndex: 1,
            pageSize: 10,
            totalRow: 50,
            keywords: null,
            data: [userDto],
          },
        });
      }),
    );

    const result = await capability().listUsers(
      { pageIndex: 1, pageSize: 10 },
      "session-token",
    );

    expect(result.pageIndex).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.totalRow).toBe(50);
    expect(result.scope).toBe("server");
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe("John Doe");
    expect(url?.searchParams.get("pageIndex")).toBe("1");
    expect(url?.searchParams.get("pageSize")).toBe("10");
  });

  it("includes search keyword in list request", async () => {
    let url: URL | undefined;
    server.use(
      http.get(listUrl, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json({
          content: {
            pageIndex: 1,
            pageSize: 10,
            totalRow: 1,
            keywords: "John",
            data: [userDto],
          },
        });
      }),
    );

    await capability().listUsers(
      { pageIndex: 1, pageSize: 10, keyword: "John" },
      "session-token",
    );

    expect(url?.searchParams.get("keyword")).toBe("John");
  });

  it("fetches a single user by ID", async () => {
    let headers: Headers | undefined;
    server.use(
      http.get(getUserUrl("1"), ({ request }) => {
        headers = request.headers;
        return HttpResponse.json({ content: [userDto] });
      }),
    );

    const user = await capability().getUserById("1", "session-token");

    expect(user.id).toBe("1");
    expect(user.name).toBe("John Doe");
    expect(headers?.get("token")).toBe("session-token");
    expect(headers?.get("tokenCybersoft")).toBe("cybersoft-token");
  });

  it("creates a new user with validated input", async () => {
    let body: unknown;
    server.use(
      http.post(usersUrl, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          content: { ...userDto, id: 100, role: "ADMIN" },
        });
      }),
    );

    const newUser = await capability().createUser(
      {
        name: "Jane Smith",
        email: "jane@example.com",
        phone: "0987654321",
        birthday: "1992-05-15",
        gender: false,
        role: "ADMIN",
        skills: ["React"],
        certifications: [],
      },
      "session-token",
    );

    expect(newUser.name).toBe("John Doe");
    expect(body).toHaveProperty("name", "Jane Smith");
    expect(body).toHaveProperty("role", "ADMIN");
    expect(body).not.toHaveProperty("password"); // Never expose password
  });

  it("updates an existing user", async () => {
    let body: unknown;
    server.use(
      http.put(getUserUrl("1"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          content: { ...userDto, name: "Updated Name" },
        });
      }),
    );

    const updated = await capability().updateUser(
      "1",
      { name: "Updated Name" },
      "session-token",
    );

    expect(updated.name).toBe("Updated Name");
    expect(body).toHaveProperty("id", 1);
    expect(body).toHaveProperty("name", "Updated Name");
  });

  it("deletes a user with the id query parameter required by the API contract", async () => {
    let requestUrl: URL | undefined;
    let bodyText = "not-read";
    server.use(
      http.delete(usersUrl, async ({ request }) => {
        requestUrl = new URL(request.url);
        bodyText = await request.text();
        return HttpResponse.json({ message: "Deleted successfully" });
      }),
    );

    await capability().deleteUser("1", "session-token");

    expect(requestUrl?.searchParams.get("id")).toBe("1");
    expect(bodyText).toBe("");
  });

  it("falls back truthfully to the complete User API snapshot when pagination shape is unusable", async () => {
    server.use(
      http.get(listUrl, () => HttpResponse.json({ content: "bad-paging-shape" })),
      http.get(usersUrl, () => HttpResponse.json({
        content: [
          userDto,
          { ...userDto, id: 2, name: "Jane Admin", email: "jane@example.com", role: "ADMIN" },
        ],
      })),
    );

    const result = await capability().listUsers(
      { pageIndex: 1, pageSize: 10, keyword: "jane" },
      "session-token",
    );

    expect(result.scope).toBe("client-fallback");
    expect(result.totalRow).toBe(1);
    expect(result.keywords).toBe("jane");
    expect(result.data.map((user) => user.name)).toEqual(["Jane Admin"]);
  });

  it("handles authorization errors correctly", async () => {
    server.use(
      http.get(listUrl, () =>
        HttpResponse.json({ message: "Unauthorized" }, { status: 401 }),
      ),
    );

    await expect(
      capability().listUsers({ pageIndex: 1, pageSize: 10 }, "expired-token"),
    ).rejects.toMatchObject({ kind: "unauthorized" });
  });

  it("handles not found errors", async () => {
    server.use(
      http.get(getUserUrl("999"), () =>
        HttpResponse.json({ message: "Not found" }, { status: 404 }),
      ),
    );

    await expect(
      capability().getUserById("999", "session-token"),
    ).rejects.toMatchObject({ kind: "not_found" });
  });

  it("reports malformed only when both pagination and the full User fallback are unusable", async () => {
    server.use(
      http.get(listUrl, () => HttpResponse.json({ invalid: "response" })),
      http.get(usersUrl, () => HttpResponse.json({ invalid: "response" })),
    );

    await expect(
      capability().listUsers({ pageIndex: 1, pageSize: 10 }, "session-token"),
    ).rejects.toMatchObject({ kind: "malformed" });
  });
  it("preserves unknown legacy roles exactly instead of normalizing them", async () => {
    server.use(
      http.get(getUserUrl("4"), () =>
        HttpResponse.json({ content: [{ ...userDto, id: 4, role: "admin" }] }),
      ),
    );

    const user = await capability().getUserById("4", "session-token");

    expect(user.role).toBe("admin");
  });

  it("omits role when an unrelated update leaves a legacy role untouched", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.put(getUserUrl("4"), async ({ request }) => {
        body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({
          content: { ...userDto, id: 4, name: "Legacy Renamed", role: "admin" },
        });
      }),
    );

    const updated = await capability().updateUser(
      "4",
      { name: "Legacy Renamed" },
      "session-token",
    );

    expect(updated.role).toBe("admin");
    expect(body).not.toHaveProperty("role");
    expect(body).not.toHaveProperty("password");
  });

  it("classifies online transport failures during update/delete as unknown outcomes", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    server.use(
      http.put(getUserUrl("1"), () => HttpResponse.error()),
      http.delete(usersUrl, () => HttpResponse.error()),
    );

    await expect(
      capability().updateUser("1", { name: "Maybe Updated" }, "session-token"),
    ).rejects.toMatchObject({ kind: "unknown_outcome" });
    await expect(
      capability().deleteUser("1", "session-token"),
    ).rejects.toMatchObject({ kind: "unknown_outcome" });
  });

  it("keeps an explicitly offline mutation distinct from an unknown outcome", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    server.use(http.put(getUserUrl("1"), () => HttpResponse.error()));

    await expect(
      capability().updateUser("1", { name: "Offline" }, "session-token"),
    ).rejects.toMatchObject({ kind: "offline" });
  });

});
