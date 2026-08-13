import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../test/server";
import {
  getCommentsByJob,
  getJobDetail,
  getJobs,
  getUserById,
  searchJobs,
} from "./legacy-api";

const apiBaseUrl = "http://api.example.test/api";
const serviceDto = {
  id: 42,
  tenCongViec: "API Service",
  moTa: "Mapped description",
  giaTien: 125,
  hinhAnh: "https://images.example.test/service.jpg",
  saoCongViec: 4,
  nguoiTao: 7,
};

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", apiBaseUrl);
  vi.stubEnv("VITE_CYBERSOFT_TOKEN", "deterministic-test-token");
});

describe("legacy Cybersoft adapter", () => {
  it("maps the complete Service collection", async () => {
    const services = await getJobs();

    expect(services).toHaveLength(7);
    expect(services[0]).toMatchObject({ id: "1", title: "Service 1" });
  });

  it("maps Service detail and search responses", async () => {
    server.use(
      http.get(`${apiBaseUrl}/cong-viec/lay-cong-viec-chi-tiet/42`, () =>
        HttpResponse.json({ content: [serviceDto] }),
      ),
      http.get(
        `${apiBaseUrl}/cong-viec/lay-danh-sach-cong-viec-theo-ten/design`,
        () => HttpResponse.json({ content: [serviceDto] }),
      ),
    );

    await expect(getJobDetail("42")).resolves.toMatchObject({
      id: "42",
      title: "API Service",
    });
    await expect(searchJobs("design")).resolves.toEqual([
      expect.objectContaining({ id: "42", title: "API Service" }),
    ]);
  });

  it("returns comment and User content through the compatibility facade", async () => {
    server.use(
      http.get(`${apiBaseUrl}/binh-luan/lay-binh-luan-theo-cong-viec/42`, () =>
        HttpResponse.json({ content: [{ id: 9, tenNguoiBinhLuan: "A", noiDung: "Good" }] }),
      ),
      http.get(`${apiBaseUrl}/users/7`, () =>
        HttpResponse.json({ content: { id: 7, name: "Seller" } }),
      ),
    );

    await expect(getCommentsByJob("42")).resolves.toEqual([
      expect.objectContaining({ id: 9, noiDung: "Good" }),
    ]);
    await expect(getUserById("7")).resolves.toEqual({ id: 7, name: "Seller" });
  });
});
