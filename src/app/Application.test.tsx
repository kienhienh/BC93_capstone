import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { renderTestApplication } from "../test/render-application";
import { server } from "../test/server";

const servicesUrl = "http://api.example.test/api/cong-viec";

describe("Home Service preview route", () => {
  it("renders the first five Services in API order as themed links", async () => {
    renderTestApplication();

    const region = await screen.findByRole("region", { name: "Explore services" });
    const serviceLinks = await within(region).findAllByRole("link");

    expect(serviceLinks).toHaveLength(5);
    expect(serviceLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/services/1",
      "/services/2",
      "/services/3",
      "/services/4",
      "/services/5",
    ]);
    expect(within(region).queryByRole("link", { name: /Service 6/ })).not.toBeInTheDocument();
  });

  it("shows a stable loading state before Services arrive", () => {
    server.use(
      http.get(servicesUrl, async () => {
        await delay("infinite");
        return HttpResponse.json({ content: [] });
      }),
    );

    renderTestApplication();

    expect(screen.getByLabelText("Loading services")).toHaveAttribute("aria-busy", "true");
  });

  it("shows the genuine empty state for a valid empty collection", async () => {
    server.use(http.get(servicesUrl, () => HttpResponse.json({ content: [] })));

    renderTestApplication();

    expect(await screen.findByText("No Services are available yet.")).toBeVisible();
  });

  it("keeps current Services visible while refreshing", async () => {
    const user = userEvent.setup();
    let requestCount = 0;
    server.use(
      http.get(servicesUrl, async () => {
        requestCount += 1;
        if (requestCount > 1) {
          await delay(100);
        }
        return HttpResponse.json({
          content: [
            {
              id: 1,
              tenCongViec: "Service 1",
              moTa: "Description 1",
              giaTien: 10,
              hinhAnh: null,
              saoCongViec: 5,
            },
          ],
        });
      }),
    );
    renderTestApplication();
    const region = await screen.findByRole("region", { name: "Explore services" });
    const serviceLink = await within(region).findByRole("link", { name: /Logo Design/ });
    expect(serviceLink).toHaveAttribute("href", "/services/1");

    await user.click(screen.getByRole("button", { name: "Refresh services" }));

    expect(within(region).getByRole("link", { name: /Logo Design/ })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Refreshing services...");
  });

  it("distinguishes malformed responses from a genuine empty collection", async () => {
    server.use(http.get(servicesUrl, () => HttpResponse.json({ content: "not-a-collection" })));

    renderTestApplication();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The Services response was not in a safe format.",
    );
  });

  it("shows the malformed-response state for invalid JSON", async () => {
    server.use(
      http.get(
        servicesUrl,
        () => new HttpResponse("{not-json", { headers: { "Content-Type": "application/json" } }),
      ),
    );

    renderTestApplication();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The Services response was not in a safe format.",
    );
  });

  it("shows an offline recovery message without exposing the transport error", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    server.use(http.get(servicesUrl, () => HttpResponse.error()));

    renderTestApplication();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You are offline. Reconnect to load Services.",
    );
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("shows a network recovery message when the browser is online", async () => {
    server.use(http.get(servicesUrl, () => HttpResponse.error()));

    renderTestApplication();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not connect to the Service marketplace.",
    );
  });

  it("shows a safe server error with a retry action", async () => {
    server.use(http.get(servicesUrl, () => new HttpResponse(null, { status: 503 })));

    renderTestApplication();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Services are temporarily unavailable.");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});
