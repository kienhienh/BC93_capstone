import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { renderTestApplication } from "../../test/render-application";
import { server } from "../../test/server";

const detailUrl = "http://api.example.test/api/cong-viec/lay-cong-viec-chi-tiet/42";
const commentsUrl = "http://api.example.test/api/binh-luan/lay-binh-luan-theo-cong-viec/42";

function useViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
}

describe("routed Service Detail", () => {
  it("renders canonical Service, taxonomy, private Seller summary, and Hire entry independently of Comments", async () => {
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
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
      http.get(commentsUrl, async () => {
        await delay("infinite");
        return HttpResponse.json({ content: [] });
      }),
    );

    renderTestApplication("/services/42");

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Accessible marketplace design",
    });
    expect(heading).toHaveFocus();
    expect(screen.getByText("A complete accessible marketplace experience.")).toBeVisible();
    expect(screen.getByText("$220")).toBeVisible();
    expect(screen.getByRole("img", { name: "Accessible marketplace design" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "About this Service" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Common Service questions" })).toBeVisible();
    expect(screen.getByText("What should I review before hiring?")).toBeVisible();

    const breadcrumb = screen.getByRole("navigation", { name: "Service breadcrumb" });
    expect(within(breadcrumb).getByText("Graphics & Design")).toBeVisible();
    expect(within(breadcrumb).getByText("Web & App Design")).toBeVisible();
    expect(within(breadcrumb).getByText("Website Design")).toBeVisible();

    const seller = screen.getByRole("region", { name: "About the Seller" });
    expect(within(seller).getByText("Alex Seller")).toBeVisible();
    expect(within(seller).getByRole("img", { name: "Alex Seller" })).toBeVisible();
    expect(screen.queryByText("private@example.test")).not.toBeInTheDocument();
    expect(screen.queryByText("+84900000000")).not.toBeInTheDocument();

    const hire = screen.getByRole("complementary", { name: "Hire this Service" });
    expect(within(hire).getByText("Responsive design package")).toBeVisible();
    expect(within(hire).getByRole("link", { name: "Continue to Hire for $220" })).toHaveAttribute(
      "href",
      "/checkout/42",
    );
    expect(screen.getByRole("status", { name: "Loading Comments" })).toBeVisible();
  });

  it("orders valid Comment dates newest-first, reveals ten initially, and progressively reveals safe fallbacks", async () => {
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Service with Comments",
            giaTien: 80,
            moTa: "Comment ordering matters.",
          },
        }],
      })),
      http.get(commentsUrl, () => HttpResponse.json({
        content: [
          ...Array.from({ length: 11 }, (_, index) => ({
            id: index + 1,
            ngayBinhLuan: `2026-01-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
            noiDung: `Comment ${index + 1}`,
            saoBinhLuan: 5,
            tenNguoiBinhLuan: `Author ${index + 1}`,
            avatar: null,
          })),
          {
            id: 12,
            ngayBinhLuan: "not-a-date",
            noiDung: "",
            saoBinhLuan: null,
            tenNguoiBinhLuan: null,
            avatar: null,
          },
        ],
      })),
    );
    const user = userEvent.setup();

    renderTestApplication("/services/42");

    const comments = await screen.findByRole("region", { name: "Comments" });
    const initialItems = await within(comments).findAllByRole("article");
    expect(initialItems).toHaveLength(10);
    expect(initialItems[0]).toHaveTextContent("Comment 11");
    expect(initialItems[9]).toHaveTextContent("Comment 2");
    expect(within(comments).queryByText("Comment 1")).not.toBeInTheDocument();

    await user.click(within(comments).getByRole("button", { name: "Show 2 more Comments" }));

    expect(within(comments).getAllByRole("article")).toHaveLength(12);
    expect(within(comments).getByText("12 Comments")).toBeVisible();
    expect(within(comments).getByText("5.0 average rating")).toBeVisible();
    expect(within(comments).getByText("Comment 1")).toBeVisible();
    expect(within(comments).getByText("Anonymous commenter")).toBeVisible();
    expect(within(comments).getByRole("img", { name: "Anonymous commenter" })).toBeVisible();
    expect(within(comments).getByText("Rating unavailable")).toBeVisible();
    expect(within(comments).getByText("Date unavailable")).toBeVisible();
    expect(within(comments).getByText("Comment unavailable.")).toBeVisible();
  });

  it("keeps valid Service content when Comments fail and retries only the Comments region", async () => {
    let commentsRequests = 0;
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Independent Service",
            giaTien: 95,
            moTa: "This Service remains readable.",
          },
        }],
      })),
      http.get(commentsUrl, () => {
        commentsRequests += 1;
        return commentsRequests === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json({ content: [] });
      }),
    );
    const user = userEvent.setup();

    renderTestApplication("/services/42");

    expect(await screen.findByRole("heading", { level: 1, name: "Independent Service" })).toBeVisible();
    const comments = screen.getByRole("region", { name: "Comments" });
    const alert = await within(comments).findByRole("alert");
    expect(alert).toHaveTextContent("Comments are temporarily unavailable.");
    expect(screen.getByText("This Service remains readable.")).toBeVisible();

    await user.click(within(alert).getByRole("button", { name: "Try loading Comments again" }));

    expect(await within(comments).findByText("No Comments have been posted yet.")).toBeVisible();
    expect(commentsRequests).toBe(2);
  });

  it("distinguishes a confirmed missing Service from a recoverable server failure", async () => {
    server.use(
      http.get(detailUrl, () => HttpResponse.json({ content: [] })),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
    );
    const missing = renderTestApplication("/services/42");

    const notFound = await screen.findByRole("heading", { level: 1, name: "Service not found" });
    expect(notFound).toHaveFocus();
    expect(screen.getByText("The requested Service does not exist.")).toBeVisible();
    missing.unmount();

    server.use(
      http.get(detailUrl, () => new HttpResponse(null, { status: 503 })),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
    );
    renderTestApplication("/services/42");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Service is temporarily unavailable.");
    expect(within(alert).getByRole("button", { name: "Try loading Service again" })).toBeEnabled();
    expect(screen.queryByText("The requested Service does not exist.")).not.toBeInTheDocument();
  });

  it("omits missing taxonomy levels and uses neutral Service and Seller fallbacks", async () => {
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Minimal Service",
            giaTien: 40,
            moTa: "Only canonical fields are available.",
          },
        }],
      })),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
    );

    renderTestApplication("/services/42");

    expect(await screen.findByRole("heading", { level: 1, name: "Minimal Service" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Service breadcrumb" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Image unavailable for Minimal Service" })).toBeVisible();
    expect(screen.getByText("Service rating unavailable")).toBeVisible();
    const seller = screen.getByRole("region", { name: "About the Seller" });
    expect(within(seller).getByText("Marketplace Seller")).toBeVisible();
    expect(within(seller).getByRole("img", { name: "Marketplace Seller" })).toBeVisible();
  });

  it("keeps Service content stable while refreshing it", async () => {
    let detailRequests = 0;
    server.use(
      http.get(detailUrl, async () => {
        detailRequests += 1;
        if (detailRequests > 1) await delay(100);
        return HttpResponse.json({
          content: [{
            congViec: {
              id: 42,
              tenCongViec: "Stable Service",
              giaTien: 60,
              moTa: "Visible during refresh.",
            },
          }],
        });
      }),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
    );
    const user = userEvent.setup();

    renderTestApplication("/services/42");
    expect(await screen.findByRole("heading", { level: 1, name: "Stable Service" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Refresh Service details" }));

    expect(screen.getByRole("heading", { level: 1, name: "Stable Service" })).toBeVisible();
    expect(screen.getByText("Visible during refresh.")).toBeVisible();
    expect(screen.getByRole("status", { name: "Refreshing Service" })).toBeVisible();
    expect(detailRequests).toBe(2);
  });

  it("reports malformed and offline Service failures without exposing transport details", async () => {
    server.use(
      http.get(detailUrl, () => HttpResponse.json({ content: [{ unexpected: true }] })),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
    );
    const malformed = renderTestApplication("/services/42");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Service returned an unsafe response.",
    );
    malformed.unmount();

    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    server.use(
      http.get(detailUrl, () => HttpResponse.error()),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
    );
    renderTestApplication("/services/42");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You are offline. Reconnect to load this Service.",
    );
  });

  it("contains malformed Comments failures inside the Comments region", async () => {
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Safe Service content",
            giaTien: 75,
            moTa: "The Service remains available.",
          },
        }],
      })),
      http.get(commentsUrl, () => HttpResponse.json({ content: "unsafe" })),
    );

    renderTestApplication("/services/42");

    expect(await screen.findByRole("heading", { level: 1, name: "Safe Service content" })).toBeVisible();
    const comments = screen.getByRole("region", { name: "Comments" });
    expect(await within(comments).findByRole("alert")).toHaveTextContent(
      "Comments returned an unsafe response.",
    );
    expect(screen.getByText("The Service remains available.")).toBeVisible();
  });

  it("keeps existing Comments visible while refreshing only the Comments region", async () => {
    let commentsRequests = 0;
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Service with refreshable Comments",
            giaTien: 50,
            moTa: "Comments refresh independently.",
          },
        }],
      })),
      http.get(commentsUrl, async () => {
        commentsRequests += 1;
        if (commentsRequests > 1) await delay(100);
        return HttpResponse.json({
          content: [{
            id: 1,
            ngayBinhLuan: "2026-08-14T01:00:00.000Z",
            noiDung: "Still readable while refreshing",
            saoBinhLuan: 4,
            tenNguoiBinhLuan: "Reader",
          }],
        });
      }),
    );
    const user = userEvent.setup();

    renderTestApplication("/services/42");
    const comments = await screen.findByRole("region", { name: "Comments" });
    expect(await within(comments).findByText("Still readable while refreshing")).toBeVisible();

    await user.click(within(comments).getByRole("button", { name: "Refresh Comments" }));

    expect(within(comments).getByText("Still readable while refreshing")).toBeVisible();
    expect(within(comments).getByRole("status", { name: "Refreshing Comments" })).toBeVisible();
    expect(commentsRequests).toBe(2);
  });

  it.each([
    { width: 375, navigationName: "Open menu" },
    { width: 768, navigationName: "Browse categories" },
    { width: 1440, navigationName: "Service Categories" },
  ])("preserves Service, Hire, then Comments reading order at $width px", async ({ width, navigationName }) => {
    useViewport(width);
    server.use(
      http.get(detailUrl, () => HttpResponse.json({
        content: [{
          congViec: {
            id: 42,
            tenCongViec: "Responsive Service",
            giaTien: 130,
            moTa: "Logical at every viewport.",
          },
        }],
      })),
      http.get(commentsUrl, () => HttpResponse.json({ content: [] })),
    );

    renderTestApplication("/services/42");

    const heading = await screen.findByRole("heading", { level: 1, name: "Responsive Service" });
    const hire = screen.getByRole("complementary", { name: "Hire this Service" });
    const comments = screen.getByRole("region", { name: "Comments" });
    expect(heading).toHaveFocus();
    expect(hire.compareDocumentPosition(comments) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    if (width === 1440) {
      expect(screen.getByRole("navigation", { name: navigationName })).toBeVisible();
    } else {
      expect(screen.getByRole("button", { name: navigationName })).toBeVisible();
    }
  });
});
