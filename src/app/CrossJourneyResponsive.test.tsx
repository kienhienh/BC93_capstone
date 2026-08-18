import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderTestApplication } from "../test/render-application";
import { server } from "../test/server";
import { setViewportWidth } from "../test/viewport";

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
 * Every individual feature already owns deterministic width coverage for
 * its own route (see each feature's own test file). This suite is the
 * cross-journey seam issue #36 calls for: one representative route per
 * journey (Public, Authenticated, Profile, Hire, Administrator), each
 * confirmed usable at all three acceptance widths in the same run.
 */
describe("Cross-journey responsive hardening", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it.each([375, 768, 1440])("keeps the public Service Discovery journey usable at %i px", async (width) => {
    setViewportWidth(width);
    renderTestApplication("/services");
    expect(await screen.findByRole("heading", { name: "All Services" })).toBeVisible();
  });

  it.each([375, 768, 1440])("keeps the authentication journey (Login) usable at %i px", async (width) => {
    setViewportWidth(width);
    renderTestApplication("/login");
    expect(await screen.findByRole("heading", { name: "Login" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Email" })).toBeVisible();
  });

  it.each([375, 768, 1440])("keeps the Profile journey usable at %i px", async (width) => {
    installProfileAndHiredServicesHandlers();
    setViewportWidth(width);
    renderTestApplication({ initialPath: "/profile" });
    expect(await screen.findByRole("heading", { name: "Your Profile" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Hired Services" })).toBeVisible();
  });

  it.each([375, 768, 1440])("keeps the Hire journey (Hired Services) usable at %i px", async (width) => {
    installProfileAndHiredServicesHandlers();
    setViewportWidth(width);
    renderTestApplication({ initialPath: "/hired-services" });
    expect(await screen.findByRole("heading", { name: "Hired Services" })).toBeVisible();
  });

  it.each([375, 768, 1440])("keeps the Administrator journey (Overview) usable at %i px", async (width) => {
    setViewportWidth(width);
    renderTestApplication({ initialPath: "/admin", isAdmin: true });
    expect(await screen.findByRole("heading", { name: "Administrator Dashboard" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Users" })[0]).toBeVisible();
  });
});
