import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { renderTestApplication } from "../../test/render-application";
import { server } from "../../test/server";

const taxonomyUrl = "http://api.example.test/api/cong-viec/lay-menu-loai-cong-viec";

describe("Home taxonomy", () => {
  it("provides an accessible Home identity without legacy marketplace navigation", async () => {
    renderTestApplication("/");

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Find the perfect freelance services for your business",
    });
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(document.title).toBe("Home | Fiverr Marketplace");
    expect(heading).toHaveFocus();
    expect(screen.getByRole("link", { name: "Login" })).toHaveTextContent("Sign In");
    expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Register" })).toHaveTextContent("Join");
    expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute("href", "/register");
    expect(screen.queryByRole("link", { name: /jobs|orders|checkout|payment/i })).not.toBeInTheDocument();
  });

  it("matches the approved Home hero with search, popular links, and trusted brands", async () => {
    const user = userEvent.setup();
    renderTestApplication("/");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Find the perfect freelance services for your business",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Business growth and professional services" }),
    ).toBeVisible();
    expect(
      within(screen.getByRole("navigation", { name: "Popular searches" })).getByRole("link", {
        name: "Logo Design",
      }),
    ).toHaveAttribute(
      "href",
      "/services?search=Logo%20Design",
    );
    const trusted = screen.getByRole("region", { name: "Trusted by" });
    for (const brand of ["Facebook", "Google", "Netflix", "P&G", "PayPal"]) {
      expect(within(trusted).getByText(brand)).toBeVisible();
    }

    await user.type(screen.getByRole("searchbox", { name: "Search services from Home" }), "mobile app");
    await user.click(screen.getByRole("button", { name: "Search from Home" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: 'Services matching "mobile app"' }),
    ).toBeVisible();
  });

  it("renders the approved Home marketing sections and multi-column footer", async () => {
    renderTestApplication("/");

    expect(screen.getByRole("heading", { name: "Popular professional services" })).toBeVisible();
    const popularServices = screen.getByRole("region", { name: "Explore services" });
    const popularCards = await within(popularServices).findAllByRole("article");
    expect(popularCards).toHaveLength(5);
    for (const title of ["Logo Design", "WordPress", "Voice Over", "Video Explainer", "Social Media"]) {
      expect(within(popularServices).getByRole("heading", { name: title })).toBeVisible();
    }
    expect(within(popularServices).getByRole("button", { name: "Previous popular services" })).toBeVisible();
    expect(within(popularServices).getByRole("button", { name: "Next popular services" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "A whole world of freelance talent at your fingertips" }),
    ).toBeVisible();
    expect(screen.getByTitle("Marketplace introduction video")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/bNpx7gpSqbY",
    );
    expect(screen.getByRole("heading", { name: "What clients say" })).toBeVisible();
    expect(screen.getByTitle("Business leadership video")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/qp0HIF3SfI4",
    );
    expect(screen.getByRole("heading", { name: "Explore the marketplace" })).toBeVisible();

    const footer = screen.getByRole("contentinfo");
    for (const heading of ["Categories", "About", "Support", "Community", "More From Fiverr"]) {
      expect(within(footer).getByRole("heading", { name: heading })).toBeVisible();
    }
    for (const link of ["Data", "Sitemap", "Investor Relations", "Fiverr Logo Maker"]) {
      expect(within(footer).getByRole("link", { name: link })).toBeVisible();
    }
    expect(within(footer).getByRole("link", { name: /^Learn/ })).toBeVisible();
    for (const social of ["Twitter", "Facebook", "LinkedIn", "Pinterest", "Instagram"]) {
      expect(within(footer).getByRole("link", { name: social })).toBeVisible();
    }
    expect(within(footer).getByRole("button", { name: "English" })).toBeVisible();
    expect(within(footer).getByRole("button", { name: "$USD" })).toBeVisible();
    expect(within(footer).getByRole("button", { name: "Accessibility options" })).toBeVisible();
  });

  it("renders Category links as compact marketplace icon shortcuts", async () => {
    renderTestApplication("/");

    const taxonomy = await screen.findByRole("region", { name: "Browse service categories" });
    const categoryLink = await within(taxonomy).findByRole("link", { name: "Graphics & Design" });
    expect(categoryLink).toHaveAttribute(
      "href",
      "/categories/1",
    );
    expect(categoryLink.querySelector(".bi-brush")).toBeInTheDocument();
    expect(within(taxonomy).queryByText("Logo & Brand Identity")).not.toBeInTheDocument();
    expect(within(taxonomy).queryByRole("link", { name: "Logo Design" })).not.toBeInTheDocument();
  });

  it("opens a canonical Category route without turning its Groups into routes", async () => {
    const user = userEvent.setup();
    renderTestApplication("/");
    const taxonomy = await screen.findByRole("region", { name: "Browse service categories" });

    await user.click(await within(taxonomy).findByRole("link", { name: "Graphics & Design" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Graphics & Design" })).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Logo & Brand Identity" })).not.toBeInTheDocument();
  });

  it("opens a selectable Subcategory leaf on the Service discovery route", async () => {
    const user = userEvent.setup();
    renderTestApplication("/");
    const taxonomy = await screen.findByRole("region", { name: "Browse service categories" });

    await user.click(await within(taxonomy).findByRole("link", { name: "Graphics & Design" }));
    await user.click(await screen.findByRole("link", { name: "Logo Design" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Services for Logo Design" }),
    ).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("distinguishes a genuine empty taxonomy from a failure", async () => {
    server.use(http.get(taxonomyUrl, () => HttpResponse.json({ content: [] })));

    renderTestApplication("/");

    expect(await screen.findByText("No Service Categories are available yet.")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a safe recoverable state for malformed taxonomy data", async () => {
    server.use(
      http.get(taxonomyUrl, () => HttpResponse.json({ content: [{ id: 1, unexpected: true }] })),
    );

    renderTestApplication("/");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Service Categories returned an unsafe response.");
    expect(within(alert).getByRole("button", { name: "Try categories again" })).toBeEnabled();
  });

  it("distinguishes a network failure from unsafe taxonomy data", async () => {
    server.use(http.get(taxonomyUrl, () => HttpResponse.error()));

    renderTestApplication("/");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not connect to load Service Categories.",
    );
  });

  it("distinguishes an offline device from a network failure", async () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    server.use(http.get(taxonomyUrl, () => HttpResponse.error()));

    renderTestApplication("/");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You are offline. Reconnect to load Service Categories.",
    );
  });

  it("keeps empty hierarchy details out of the compact Home navigation", async () => {
    server.use(
      http.get(taxonomyUrl, () =>
        HttpResponse.json({
          content: [
            { id: 2, tenLoaiCongViec: "Writing", dsNhomChiTietLoai: [] },
            {
              id: 3,
              tenLoaiCongViec: "Music",
              dsNhomChiTietLoai: [
                {
                  id: 30,
                  tenNhom: "Audio",
                  hinhAnh: null,
                  maLoaiCongviec: 3,
                  dsChiTietLoai: [],
                },
              ],
            },
          ],
        }),
      ),
    );

    renderTestApplication("/");

    expect(await screen.findByRole("link", { name: "Writing" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Music" })).toBeVisible();
    expect(screen.queryByText("No Service Groups are available in Writing.")).not.toBeInTheDocument();
    expect(screen.queryByText("No Service Subcategories are available in Audio.")).not.toBeInTheDocument();
    expect(screen.queryByText("Other")).not.toBeInTheDocument();
  });

  it("does not show a manual refresh control in the approved marketplace grid", async () => {
    renderTestApplication("/");
    const taxonomy = await screen.findByRole("region", { name: "Browse service categories" });
    expect(await within(taxonomy).findByRole("link", { name: "Graphics & Design" })).toBeVisible();
    expect(within(taxonomy).queryByRole("button", { name: "Refresh categories" })).not.toBeInTheDocument();
  });
});
