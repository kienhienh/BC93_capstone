import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "../../test/server";
import { createCybersoftAdminUserManagementCapability } from "./admin-user-management";

const apiBaseUrl = "http://api.example.test/api";
const listUrl = `${apiBaseUrl}/users/phan-trang-tim-kiem`;
const usersUrl = `${apiBaseUrl}/users`;
const getUserUrl = (id: string) => `${apiBaseUrl}/users/${id}`;

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

  it("handles malformed responses", async () => {
    server.use(
      http.get(listUrl, () =>
        HttpResponse.json({ invalid: "response" }),
      ),
    );

    await expect(
      capability().listUsers({ pageIndex: 1, pageSize: 10 }, "session-token"),
    ).rejects.toMatchObject({ kind: "malformed" });
  });
});
