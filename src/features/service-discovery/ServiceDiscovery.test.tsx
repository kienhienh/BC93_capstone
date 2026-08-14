import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { renderTestApplication } from "../../test/render-application";
import { server } from "../../test/server";

const apiBaseUrl = "http://api.example.test/api";

function detailedService(index: number) {
  return {
    congViec: {
      id: index,
      tenCongViec: "HTML Service " + index,
      danhGia: index * 2,
      giaTien: index * 10,
      hinhAnh: "https://images.example.test/html-" + index + ".jpg",
      moTa: "Professional HTML service " + index,
      saoCongViec: index % 2 === 0 ? 5 : 4,
    },
    tenNguoiTao: "Seller " + index,
    avatar: null,
  };
}

describe("routed Service discovery", () => {
  it("normalizes a Home search, renders 12 cards, then paginates the stable result", async () => {
    server.use(
      http.get(
        apiBaseUrl + "/cong-viec/lay-danh-sach-cong-viec-theo-ten/mobile%20app",
        () => HttpResponse.json({ content: Array.from({ length: 13 }, (_, index) => detailedService(index + 1)) }),
      ),
    );
    const user = userEvent.setup();
    renderTestApplication("/services?search=%20%20mobile%20%20%20app%20&subcategory=100");

    expect(await screen.findByRole("heading", { name: 'Results for "mobile app"' })).toBeVisible();
    const results = await screen.findByRole("region", { name: "Service results" });
    expect(within(results).getAllByRole("link")).toHaveLength(12);
    expect(screen.getByText("13 services available")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(await within(results).findByRole("link", { name: /HTML Service 13/ })).toBeVisible();
    expect(within(results).getAllByRole("link")).toHaveLength(1);
  });

  it("applies supported price, rating, and sort controls before pagination", async () => {
    server.use(
      http.get(
        apiBaseUrl + "/cong-viec/lay-danh-sach-cong-viec-theo-ten/html",
        () => HttpResponse.json({ content: [detailedService(1), detailedService(2), detailedService(3), detailedService(4)] }),
      ),
    );
    const user = userEvent.setup();
    renderTestApplication("/services?search=html");
    await screen.findByRole("heading", { name: 'Results for "html"' });

    await user.type(screen.getByLabelText("Minimum price"), "20");
    await user.type(screen.getByLabelText("Maximum price"), "40");
    await user.selectOptions(screen.getByLabelText("Minimum rating"), "5");
    await user.selectOptions(screen.getByLabelText("Sort services"), "price-desc");

    const cards = await within(screen.getByRole("region", { name: "Service results" })).findAllByRole("link");
    expect(cards.map((card) => card.textContent)).toEqual([
      expect.stringContaining("HTML Service 4"),
      expect.stringContaining("HTML Service 2"),
    ]);
  });

  it("explains an invalid price range without silently hiding results", async () => {
    server.use(
      http.get(
        apiBaseUrl + "/cong-viec/lay-danh-sach-cong-viec-theo-ten/html",
        () => HttpResponse.json({ content: [detailedService(1), detailedService(2)] }),
      ),
    );
    renderTestApplication("/services?search=html&minPrice=50&maxPrice=20");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Minimum price cannot be greater than maximum price.",
    );
    expect(within(await screen.findByRole("region", { name: "Service results" })).getAllByRole("link")).toHaveLength(2);
  });

  it("distinguishes genuine and filtered empty results", async () => {
    server.use(http.get(apiBaseUrl + "/cong-viec/lay-danh-sach-cong-viec-theo-ten/none", () => HttpResponse.json({ content: [] })));
    const view = renderTestApplication("/services?search=none");
    expect(await screen.findByRole("heading", { name: "No Services are available" })).toBeVisible();

    view.unmount();
    server.use(http.get(apiBaseUrl + "/cong-viec/lay-danh-sach-cong-viec-theo-ten/html", () => HttpResponse.json({ content: [detailedService(1)] })));
    renderTestApplication("/services?search=html&minPrice=999");
    expect(await screen.findByRole("heading", { name: "No Services match these filters" })).toBeVisible();
  });

  it("shows unavailable category and subcategory classifications distinctly", async () => {
    const categoryView = renderTestApplication("/categories/999");
    expect(await screen.findByRole("heading", { name: "Service Category unavailable" })).toBeVisible();
    categoryView.unmount();

    renderTestApplication("/services?subcategory=999");
    expect(await screen.findByRole("heading", { name: "Service Subcategory unavailable" })).toBeVisible();
  });

  it("restores URL-owned results through Back and Forward without stale results winning", async () => {
    server.use(
      http.get(apiBaseUrl + "/cong-viec/lay-danh-sach-cong-viec-theo-ten/html", async () => {
        await delay(80);
        return HttpResponse.json({ content: [detailedService(1)] });
      }),
      http.get(apiBaseUrl + "/cong-viec/lay-danh-sach-cong-viec-theo-ten/mobile", () =>
        HttpResponse.json({ content: [{ ...detailedService(2), congViec: { ...detailedService(2).congViec, tenCongViec: "Mobile Service" } }] }),
      ),
    );
    const user = userEvent.setup();
    const app = renderTestApplication("/services?search=html");
    const search = screen.getByRole("searchbox", { name: "Search services" });
    await user.clear(search);
    await user.type(search, "mobile");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("link", { name: /Mobile Service/ })).toBeVisible();
    expect(app.currentLocation()).toBe("/services?search=mobile");

    app.navigateHistory(-1);
    expect(await screen.findByRole("heading", { name: 'Results for "html"' })).toBeVisible();
    app.navigateHistory(1);
    expect(await screen.findByRole("heading", { name: 'Results for "mobile"' })).toBeVisible();
    expect(screen.getByRole("link", { name: /Mobile Service/ })).toBeVisible();
  });

  it("normalizes malformed URL filters to supported defaults", async () => {
    const app = renderTestApplication("/services?minPrice=-2&maxPrice=nope&rating=2&sort=newest&page=0");
    await screen.findByRole("heading", { name: "All Services" });
    expect(screen.getByLabelText("Minimum price")).toHaveValue(null);
    expect(screen.getByLabelText("Maximum price")).toHaveValue(null);
    expect(screen.getByLabelText("Minimum rating")).toHaveValue("");
    expect(screen.getByLabelText("Sort services")).toHaveValue("api");
    expect(app.currentLocation()).toBe("/services");
  });

  it("selects complete and Subcategory sources and restores shared filter state on refresh", async () => {
    let completeRequests = 0;
    let subcategoryRequests = 0;
    server.use(
      http.get(apiBaseUrl + "/cong-viec", () => {
        completeRequests += 1;
        return HttpResponse.json({ content: [] });
      }),
      http.get(apiBaseUrl + "/cong-viec/lay-cong-viec-theo-chi-tiet-loai/100", () => {
        subcategoryRequests += 1;
        return HttpResponse.json({ content: [detailedService(2)] });
      }),
    );
    const all = renderTestApplication("/services");
    expect(await screen.findByRole("heading", { name: "No Services are available" })).toBeVisible();
    all.unmount();

    const sharedUrl = "/services?subcategory=100&minPrice=10&rating=4&sort=price-asc";
    const subcategory = renderTestApplication(sharedUrl);
    expect(await screen.findByRole("heading", { name: "Services for Logo Design" })).toBeVisible();
    expect(await screen.findByRole("link", { name: /HTML Service 2/ })).toBeVisible();
    expect(screen.getByLabelText("Minimum price")).toHaveValue(10);
    expect(screen.getByLabelText("Minimum rating")).toHaveValue("4");
    expect(screen.getByLabelText("Sort services")).toHaveValue("price-asc");
    subcategory.unmount();

    renderTestApplication(sharedUrl);
    expect(await screen.findByRole("link", { name: /HTML Service 2/ })).toBeVisible();
    expect(completeRequests).toBe(1);
    expect(subcategoryRequests).toBe(2);
  });

  it("keeps cards visible and announces a background refresh", async () => {
    let requestCount = 0;
    server.use(http.get(apiBaseUrl + "/cong-viec/lay-danh-sach-cong-viec-theo-ten/html", async () => {
      requestCount += 1;
      if (requestCount > 1) await delay(100);
      return HttpResponse.json({ content: [detailedService(1)] });
    }));
    const user = userEvent.setup();
    renderTestApplication("/services?search=html");
    const card = await screen.findByRole("link", { name: /HTML Service 1/ });

    await user.click(screen.getByRole("button", { name: "Refresh results" }));
    expect(card).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Refreshing Services...");
  });

  it("renders malformed and recoverable server errors at the results boundary", async () => {
    server.use(http.get(apiBaseUrl + "/cong-viec/lay-danh-sach-cong-viec-theo-ten/broken", () => HttpResponse.json({ content: "bad" })));
    const malformed = renderTestApplication("/services?search=broken");
    expect(await screen.findByRole("alert")).toHaveTextContent("The Services response was not in a safe format.");
    malformed.unmount();

    server.use(http.get(apiBaseUrl + "/cong-viec/lay-danh-sach-cong-viec-theo-ten/server", () => new HttpResponse(null, { status: 503 })));
    renderTestApplication("/services?search=server");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Services are temporarily unavailable.");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("shows only three sliding page numbers between Previous and Next at 375px", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    server.use(http.get(apiBaseUrl + "/cong-viec/lay-danh-sach-cong-viec-theo-ten/mobile", () =>
      HttpResponse.json({ content: Array.from({ length: 60 }, (_, index) => detailedService(index + 1)) }),
    ));
    const view = renderTestApplication("/services?search=mobile&page=3");
    const pagination = await screen.findByRole("navigation", { name: "Service result pages" });

    expect(within(pagination).getAllByRole("button")).toHaveLength(5);
    expect(within(pagination).getByRole("button", { name: "Previous page" })).toBeVisible();
    expect(within(pagination).getByRole("button", { name: "2" })).toBeVisible();
    expect(within(pagination).getByRole("button", { name: "3" })).toHaveAttribute("aria-current", "page");
    expect(within(pagination).getByRole("button", { name: "4" })).toBeVisible();
    expect(within(pagination).getByRole("button", { name: "Next page" })).toBeVisible();

    view.unmount();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  });
});
