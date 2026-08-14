import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { renderTestApplication } from "../../test/render-application";
import { server } from "../../test/server";

const taxonomyUrl = "http://api.example.test/api/cong-viec/lay-menu-loai-cong-viec";

function useViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  window.dispatchEvent(new Event("resize"));
}

describe("routed Service Category landing page", () => {
  it("opens a complete landing composition for every desktop Category navigation item", async () => {
    const categoryNames = [
      "Graphics & Design",
      "Digital Marketing",
      "Writing & Translation",
      "Video & Animation",
      "Music & Audio",
      "Content Creator",
      "CI/CD",
      "Design & Marketing",
      "UI UX Design",
      "react",
      "string",
    ];
    server.use(
      http.get(taxonomyUrl, () => HttpResponse.json({
        content: categoryNames.map((name, index) => ({
          id: index + 1,
          tenLoaiCongViec: name,
          dsNhomChiTietLoai: [{
            id: 100 + index,
            tenNhom: `${name} Group`,
            hinhAnh: null,
            maLoaiCongviec: index + 1,
            dsChiTietLoai: [{ id: 200 + index, tenChiTiet: `${name} Service` }],
          }],
        })),
      })),
    );
    useViewport(1440);
    const user = userEvent.setup();
    renderTestApplication("/services");

    for (const name of categoryNames) {
      const navigation = await screen.findByRole("navigation", { name: "Service Categories" });
      await user.click(await within(navigation).findByRole("link", { name }));

      expect(await screen.findByRole("heading", { level: 1, name })).toBeVisible();
      expect(screen.getByRole("region", {
        name: name === "Graphics & Design" ? `Most popular in ${name}` : `Featured in ${name}`,
      })).toBeVisible();
      expect(screen.getByRole("region", { name: `Explore ${name}` })).toBeVisible();
      expect(screen.getByRole("region", { name: `Services related to ${name}` })).toBeVisible();
    }
  });

  it("keeps a stable Category-shaped loading region until taxonomy arrives", async () => {
    server.use(
      http.get(taxonomyUrl, async () => {
        await delay(100);
        return HttpResponse.json({
          content: [
            {
              id: 1,
              tenLoaiCongViec: "Graphics & Design",
              dsNhomChiTietLoai: [],
            },
          ],
        });
      }),
    );

    renderTestApplication("/categories/1");

    const loading = screen.getByRole("status", { name: "Loading Service Category" });
    expect(loading).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("region", { name: "Service Category preview" })).toBeVisible();
    expect(await screen.findByRole("heading", { level: 1, name: "Graphics & Design" })).toBeVisible();
  });

  it("distinguishes a genuinely empty taxonomy from a missing Category", async () => {
    server.use(
      http.get(taxonomyUrl, () => HttpResponse.json({ content: [] })),
    );

    renderTestApplication("/categories/1");

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "No Service Categories are available",
    });
    expect(heading).toHaveFocus();
    expect(screen.queryByText("The requested Service Category does not exist.")).not.toBeInTheDocument();
  });

  it("preserves cached Category content while refreshing taxonomy in the background", async () => {
    let requestCount = 0;
    server.use(
      http.get(taxonomyUrl, async () => {
        requestCount += 1;
        if (requestCount > 1) await delay(100);
        return HttpResponse.json({
          content: [
            {
              id: 1,
              tenLoaiCongViec: "Graphics & Design",
              dsNhomChiTietLoai: [
                {
                  id: 10,
                  tenNhom: "Logo & Brand Identity",
                  hinhAnh: null,
                  maLoaiCongviec: 1,
                  dsChiTietLoai: [{ id: 100, tenChiTiet: "Logo Design" }],
                },
              ],
            },
          ],
        });
      }),
    );
    const user = userEvent.setup();

    renderTestApplication("/");
    const taxonomy = await screen.findByRole("region", { name: "Browse service categories" });
    await user.click(await within(taxonomy).findByRole("link", { name: "Graphics & Design" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Graphics & Design" })).toBeVisible();
    expect(screen.getByRole("status", { name: "Refreshing Service Category" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Explore Graphics & Design" })).toBeVisible();
    expect(await screen.findByText("Service Category is up to date.")).toBeVisible();
    expect(requestCount).toBe(2);
  });

  it("renders the approved Graphics & Design composition from validated taxonomy", async () => {
    renderTestApplication("/categories/1");

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Graphics & Design",
    });
    expect(heading).toHaveFocus();
    expect(document.title).toBe("Graphics & Design | Fiverr Marketplace");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Designs to make you stand out.")).toBeVisible();

    const shortcuts = screen.getByRole("navigation", {
      name: "Featured Graphics & Design services",
    });
    expect(within(shortcuts).getByRole("link", { name: "Logo Design" })).toHaveAttribute(
      "href",
      "/services?subcategory=100",
    );

    const explore = screen.getByRole("region", { name: "Explore Graphics & Design" });
    expect(within(explore).getByRole("heading", { name: "Logo & Brand Identity" })).toBeVisible();
    expect(within(explore).queryByRole("link", { name: "Logo & Brand Identity" })).not.toBeInTheDocument();
    expect(within(explore).getByRole("link", { name: "Logo Design" })).toHaveAttribute(
      "href",
      "/services?subcategory=100",
    );
    expect(within(explore).getByRole("img", { name: "Logo & Brand Identity" })).toBeVisible();

    const related = screen.getByRole("navigation", {
      name: "Services related to Graphics & Design",
    });
    expect(within(related).getByRole("link", { name: "Minimalist logo design" })).toHaveAttribute(
      "href",
      "/services?search=Minimalist%20logo%20design",
    );
  });

  it("opens a Subcategory on canonical Service discovery", async () => {
    const user = userEvent.setup();
    const app = renderTestApplication("/categories/1");

    const explore = await screen.findByRole("region", { name: "Explore Graphics & Design" });
    await user.click(within(explore).getByRole("link", { name: "Logo Design" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Services for Logo Design" }),
    ).toBeVisible();
    expect(app.currentLocation()).toBe("/services?subcategory=100");
  });

  it("builds a complete fallback presentation while omitting only empty Groups", async () => {
    server.use(
      http.get(taxonomyUrl, () =>
        HttpResponse.json({
          content: [
            {
              id: 2,
              tenLoaiCongViec: "Writing & Translation",
              dsNhomChiTietLoai: [
                {
                  id: 20,
                  tenNhom: "Articles & Blog Posts",
                  hinhAnh: null,
                  maLoaiCongviec: 2,
                  dsChiTietLoai: [],
                },
                {
                  id: 21,
                  tenNhom: "Translation",
                  hinhAnh: null,
                  maLoaiCongviec: 2,
                  dsChiTietLoai: [{ id: 200, tenChiTiet: "English Translation" }],
                },
              ],
            },
          ],
        }),
      ),
    );

    renderTestApplication("/categories/2");

    expect(await screen.findByRole("heading", { level: 1, name: "Writing & Translation" })).toBeVisible();
    expect(screen.getByText("Explore services across Writing & Translation.")).toBeVisible();
    expect(
      within(screen.getByRole("navigation", { name: "Featured Writing & Translation services" }))
        .getByRole("link", { name: "English Translation" }),
    ).toHaveAttribute("href", "/services?subcategory=200");
    expect(
      within(screen.getByRole("navigation", { name: "Services related to Writing & Translation" }))
        .getByRole("link", { name: "English Translation" }),
    ).toHaveAttribute("href", "/services?search=English%20Translation");
    const explore = screen.getByRole("region", { name: "Explore Writing & Translation" });
    expect(within(explore).queryByRole("heading", { name: "Articles & Blog Posts" })).not.toBeInTheDocument();
    expect(within(explore).getByRole("heading", { name: "Translation" })).toBeVisible();
    expect(within(explore).getByRole("link", { name: "English Translation" })).toHaveAttribute(
      "href",
      "/services?subcategory=200",
    );
  });

  it("distinguishes a missing Category from a recoverable taxonomy failure", async () => {
    const missing = renderTestApplication("/categories/999");
    const notFound = await screen.findByRole("heading", { name: "Service Category not found" });
    expect(notFound).toHaveFocus();
    missing.unmount();

    server.use(http.get(taxonomyUrl, () => new HttpResponse(null, { status: 503 })));
    renderTestApplication("/categories/1");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Service Categories are temporarily unavailable.");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("reports malformed and offline failures safely on the Category route", async () => {
    server.use(
      http.get(taxonomyUrl, () => HttpResponse.json({ content: [{ id: 1, unexpected: true }] })),
    );
    const malformed = renderTestApplication("/categories/1");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Service Categories returned an unsafe response.",
    );
    malformed.unmount();

    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    server.use(http.get(taxonomyUrl, () => HttpResponse.error()));
    renderTestApplication("/categories/1");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You are offline. Reconnect to load Service Categories.",
    );
  });

  it.each([
    { width: 375, navigationName: "Open menu" },
    { width: 768, navigationName: "Browse categories" },
    { width: 1440, navigationName: "Service Categories" },
  ])("keeps routed Category semantics accessible at $width px", async ({ width, navigationName }) => {
    useViewport(width);
    renderTestApplication("/categories/1");

    const heading = await screen.findByRole("heading", { level: 1, name: "Graphics & Design" });
    expect(heading).toHaveFocus();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const explore = screen.getByRole("region", { name: "Explore Graphics & Design" });
    expect(within(explore).queryByRole("link", { name: "Logo & Brand Identity" })).not.toBeInTheDocument();
    expect(within(explore).getByRole("link", { name: "Logo Design" })).toBeVisible();

    if (width === 1440) {
      expect(screen.getByRole("navigation", { name: navigationName })).toBeVisible();
    } else {
      expect(screen.getByRole("button", { name: navigationName })).toBeVisible();
    }
  });
});
