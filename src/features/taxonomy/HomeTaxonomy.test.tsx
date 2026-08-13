import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { renderTestApplication } from "../../test/render-application";
import { server } from "../../test/server";

const taxonomyUrl = "http://api.example.test/api/cong-viec/lay-menu-loai-cong-viec";

describe("Home taxonomy", () => {
  it("provides an accessible Home identity without legacy marketplace navigation", async () => {
    renderTestApplication("/");

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Find the right Service for your next project",
    });
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(document.title).toBe("Home | Fiverr Marketplace");
    expect(heading).toHaveFocus();
    expect(screen.queryByRole("link", { name: /jobs|orders|checkout|payment/i })).not.toBeInTheDocument();
  });

  it("renders Category links, Group headings, and selectable Subcategory leaves", async () => {
    renderTestApplication("/");

    const taxonomy = await screen.findByRole("region", { name: "Browse service categories" });
    expect(await within(taxonomy).findByRole("link", { name: "Graphics & Design" })).toHaveAttribute(
      "href",
      "/categories/1",
    );
    expect(
      within(taxonomy).getByRole("heading", { name: "Logo & Brand Identity" }),
    ).toBeVisible();
    expect(
      within(taxonomy).queryByRole("link", { name: "Logo & Brand Identity" }),
    ).not.toBeInTheDocument();
    expect(within(taxonomy).getByRole("link", { name: "Logo Design" })).toHaveAttribute(
      "href",
      "/services?subcategory=100",
    );
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

    await user.click(await within(taxonomy).findByRole("link", { name: "Logo Design" }));

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

  it("does not invent Groups or Subcategories when a hierarchy level is empty", async () => {
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

    expect(await screen.findByText("No Service Groups are available in Writing.")).toBeVisible();
    expect(screen.getByText("No Service Subcategories are available in Audio.")).toBeVisible();
    expect(screen.queryByText("Other")).not.toBeInTheDocument();
  });

  it("keeps the current hierarchy visible and announces a refresh", async () => {
    const user = userEvent.setup();
    let requestCount = 0;
    server.use(
      http.get(taxonomyUrl, async () => {
        requestCount += 1;
        if (requestCount > 1) await delay(150);
        return HttpResponse.json({
          content: [
            {
              id: requestCount,
              tenLoaiCongViec: requestCount === 1 ? "Graphics & Design" : "Digital Marketing",
              dsNhomChiTietLoai: [],
            },
          ],
        });
      }),
    );

    renderTestApplication("/");
    const taxonomy = await screen.findByRole("region", { name: "Browse service categories" });
    expect(await within(taxonomy).findByRole("link", { name: "Graphics & Design" })).toBeVisible();

    await user.click(within(taxonomy).getByRole("button", { name: "Refresh categories" }));

    expect(within(taxonomy).getByRole("link", { name: "Graphics & Design" })).toBeVisible();
    expect(within(taxonomy).getByRole("status")).toHaveTextContent(
      "Refreshing service categories...",
    );
    expect(await within(taxonomy).findByRole("link", { name: "Digital Marketing" })).toBeVisible();
  });
});
