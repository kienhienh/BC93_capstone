import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { runAxe } from "../test/a11y";
import { renderTestApplication } from "../test/render-application";
import { server } from "../test/server";

const apiBaseUrl = "http://api.example.test/api";

function installProfileAndHiredServicesHandlers() {
  server.use(
    http.get(`${apiBaseUrl}/users/700`, () => HttpResponse.json({
      content: {
        id: 700, name: "Alex Morgan", email: "alex@example.com", phone: "+84901234567",
        birthday: "1995-04-18", avatar: null, gender: true, role: "USER", skill: [], certification: [],
      },
    })),
    http.get(`${apiBaseUrl}/thue-cong-viec/lay-danh-sach-da-thue`, () => HttpResponse.json({ content: [] })),
  );
}

/**
 * Each feature ticket already owns local accessibility for its own route.
 * This suite is the cross-journey seam issue #37 calls for: one
 * representative screen per journey (Public, Authenticated, Profile,
 * Hire, Administrator), plus a dialog/drawer open state, scanned with
 * axe-core (jest-axe) so critical/serious violations fail this repo's
 * existing `npm test` gate. color-contrast is excluded because jsdom does
 * not perform real rendering; that remains a human release check.
 */
describe("Cross-journey WCAG 2.2 AA hardening", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("has no axe violations on the public Service Discovery journey", async () => {
    const { container } = renderTestApplication("/services");
    await screen.findByRole("heading", { name: "All Services" });
    expect(await runAxe(container)).toHaveNoViolations();
  });

  it("has no axe violations on the authentication journey (Login)", async () => {
    const { container } = renderTestApplication("/login");
    await screen.findByRole("heading", { name: "Login" });
    expect(await runAxe(container)).toHaveNoViolations();
  });

  it("has no axe violations on the Profile journey", async () => {
    installProfileAndHiredServicesHandlers();
    const { container } = renderTestApplication({ initialPath: "/profile" });
    await screen.findByRole("heading", { name: "Your Profile" });
    await screen.findByRole("heading", { name: "Hired Services" });
    expect(await runAxe(container)).toHaveNoViolations();
  });

  it("has no axe violations on the Hire journey (Hired Services)", async () => {
    installProfileAndHiredServicesHandlers();
    const { container } = renderTestApplication({ initialPath: "/hired-services" });
    await screen.findByRole("heading", { name: "Hired Services" });
    expect(await runAxe(container)).toHaveNoViolations();
  });

  it("has no axe violations on the Administrator journey (Overview)", async () => {
    const { container } = renderTestApplication({ initialPath: "/admin", isAdmin: true });
    await screen.findByRole("heading", { name: "Administrator Dashboard" });
    expect(await runAxe(container)).toHaveNoViolations();
  });

  it("has no axe violations with the mobile navigation drawer open", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    const user = userEvent.setup();
    const { container } = renderTestApplication("/services");
    await user.click(await screen.findByRole("button", { name: "Open menu" }));
    await screen.findByRole("dialog", { name: "Marketplace menu" });
    expect(await runAxe(container)).toHaveNoViolations();
  });

  it("has no axe violations on a rating- and image-heavy Service Detail page with Comments", async () => {
    server.use(
      http.get(`${apiBaseUrl}/cong-viec/lay-cong-viec-chi-tiet/42`, () => HttpResponse.json({
        content: [{
          id: 42,
          congViec: {
            id: 42,
            tenCongViec: "Accessible marketplace design",
            danhGia: 17,
            giaTien: 220,
            nguoiTao: 700,
            hinhAnh: "https://images.example.test/service-detail.jpg",
            moTa: "A complete accessible marketplace experience.",
            moTaNgan: "Responsive design package",
            saoCongViec: 4.8,
          },
          tenLoaiCongViec: "Graphics & Design",
          tenNhomChiTietLoai: "Web & App Design",
          tenChiTietLoai: "Website Design",
          tenNguoiTao: "Alex Seller",
          avatar: "https://images.example.test/alex.jpg",
          email: "private@example.test",
          phone: "+84900000000",
        }],
      })),
      http.get(`${apiBaseUrl}/binh-luan/lay-binh-luan-theo-cong-viec/42`, () => HttpResponse.json({
        content: [{
          id: 901, ngayBinhLuan: "2026-08-14T04:30:00.000Z", noiDung: "Clear and helpful delivery.",
          saoBinhLuan: 5, tenNguoiBinhLuan: "Alex Morgan",
        }],
      })),
    );
    const { container } = renderTestApplication("/services/42");
    await screen.findByRole("heading", { name: "Accessible marketplace design" });
    await screen.findByText("Clear and helpful delivery.");
    expect(await runAxe(container)).toHaveNoViolations();
  });

  it("has no axe violations with an Administrator destructive-confirmation dialog open", async () => {
    server.use(
      http.get(`${apiBaseUrl}/thue-cong-viec`, () => HttpResponse.json({
        content: [{ id: 100, maCongViec: 1, maNguoiThue: 5, ngayThue: "2025-01-01", hoanThanh: false }],
      })),
      http.get(`${apiBaseUrl}/cong-viec`, () => HttpResponse.json({
        content: [{ id: 1, tenCongViec: "Logo Design Service", giaTien: 50, nguoiTao: 10 }],
      })),
      http.get(`${apiBaseUrl}/users`, () => HttpResponse.json({
        content: [{ id: 5, name: "Ada Lovelace" }, { id: 10, name: "Sam Seller" }],
      })),
    );
    const user = userEvent.setup();
    const { container } = renderTestApplication({ initialPath: "/admin/hired-services", isAdmin: true });
    await user.click(await screen.findByRole("button", { name: "Cancel Hired Service 100" }));
    const dialog = await screen.findByRole("dialog", { name: "Cancel Hired Service 100?" });
    expect(within(dialog).getByRole("button", { name: "Go back" })).toHaveFocus();
    expect(await runAxe(container)).toHaveNoViolations();
  });
});
