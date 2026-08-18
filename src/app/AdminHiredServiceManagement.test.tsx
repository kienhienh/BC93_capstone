import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderTestApplication } from "../test/render-application";
import { server } from "../test/server";

const apiBaseUrl = "http://api.example.test/api";
const hiredServicesUrl = `${apiBaseUrl}/thue-cong-viec`;
const hiredServiceUrl = (id: string) => `${hiredServicesUrl}/${id}`;
const servicesUrl = `${apiBaseUrl}/cong-viec`;
const usersUrl = `${apiBaseUrl}/users`;

const serviceOne = { id: 1, tenCongViec: "Logo Design Service", giaTien: 50, nguoiTao: 10 };
const serviceTwo = { id: 2, tenCongViec: "Business Card Service", giaTien: 30, nguoiTao: 11 };
const users = [
  { id: 5, name: "Ada Lovelace" },
  { id: 6, name: "Grace Hopper" },
  { id: 10, name: "Sam Seller" },
  { id: 11, name: "Sonia Seller" },
];
const hiredActive = { id: 100, maCongViec: 1, maNguoiThue: 5, ngayThue: "2025-01-01", hoanThanh: false };
const hiredCompleted = { id: 101, maCongViec: 2, maNguoiThue: 6, ngayThue: "2025-02-02", hoanThanh: true };

function installDefaultHandlers() {
  server.use(
    http.get(hiredServicesUrl, () => HttpResponse.json({ content: [hiredActive, hiredCompleted] })),
    http.get(servicesUrl, () => HttpResponse.json({ content: [serviceOne, serviceTwo] })),
    http.get(usersUrl, () => HttpResponse.json({ content: users })),
  );
}

async function heading(name: string) {
  return screen.findByRole("heading", { name }, { timeout: 5_000 });
}

describe("Administrator Hired Service Management", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    installDefaultHandlers();
  });

  it("turns Hired Services into a real Admin destination and preserves q/page/pageSize through routes", async () => {
    const query = "?q=ada&page=1&pageSize=25";
    const app = renderTestApplication({ initialPath: `/admin/hired-services${query}`, isAdmin: true });
    const grid = await screen.findByRole("grid", { name: "Hired Service list" }, { timeout: 5_000 });
    expect(app.currentLocation()).toBe(`/admin/hired-services${query}`);
    expect(within(grid).getByRole("link", { name: "View Hired Service 100" })).toHaveAttribute("href", `/admin/hired-services/100${query}`);
    app.unmount();

    renderTestApplication({ initialPath: `/admin/hired-services/100${query}`, isAdmin: true });
    await heading("Hired Service Detail");
    expect(await screen.findByText("Ada Lovelace")).toBeVisible();
    expect(await screen.findByText("Logo Design Service")).toBeVisible();
    expect(await screen.findByText("Sam Seller")).toBeVisible();
    expect(await screen.findByRole("link", { name: "Back to list" })).toHaveAttribute("href", `/admin/hired-services${query}`);
  });

  it("inspects truthful Client, Service, Seller, Hire date, status, and current price", async () => {
    renderTestApplication({ initialPath: "/admin/hired-services", isAdmin: true });
    const grid = await screen.findByRole("grid", { name: "Hired Service list" });
    const activeRow = within(grid).getByRole("link", { name: "View Hired Service 100" }).closest("tr");
    expect(activeRow).not.toBeNull();
    if (activeRow) {
      const row = within(activeRow);
      expect(row.getByText("Ada Lovelace")).toBeVisible();
      expect(row.getByText("Logo Design Service")).toBeVisible();
      expect(row.getByText("Sam Seller")).toBeVisible();
      expect(row.getByText("2025-01-01")).toBeVisible();
      expect(row.getByText("Active")).toBeVisible();
      expect(row.getByText("50")).toBeVisible();
    }
  });

  it("filters and paginates entirely client-side because keyword search 500s server-side", async () => {
    const app = renderTestApplication({ initialPath: "/admin/hired-services", isAdmin: true });
    await screen.findByRole("grid", { name: "Hired Service list" });
    expect(screen.getByText(/keyword search does not work server-side/)).toBeVisible();
    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox", { name: /Search Hired Services/ }), "missing-keyword");
    await waitFor(() => expect(app.currentLocation()).toBe("/admin/hired-services?q=missing-keyword&page=1&pageSize=10"));
    expect(await screen.findByText(/No Hired Services match your search/)).toHaveAttribute("data-state", "query-empty");
  });

  it("labels the status filter as current-page-only and never changes the total count", async () => {
    const bulk = Array.from({ length: 11 }, (_, index) => ({
      id: 200 + index, maCongViec: 1, maNguoiThue: 5, ngayThue: "2025-01-01", hoanThanh: false,
    }));
    server.use(http.get(hiredServicesUrl, () => HttpResponse.json({ content: bulk })));
    renderTestApplication({ initialPath: "/admin/hired-services", isAdmin: true });
    await screen.findByRole("grid", { name: "Hired Service list" });
    expect(screen.getByText(/only affects rows already on the current page/)).toBeVisible();
    const user = userEvent.setup();
    expect(screen.getByText("Page 1 of 2 (Total: 11 Hired Services)")).toBeVisible();
    await user.selectOptions(screen.getByRole("combobox", { name: /Status/ }), "completed");
    expect(await screen.findByText(/No rows on this page match the selected status/)).toBeVisible();
    expect(screen.queryByRole("link", { name: "View Hired Service 200" })).not.toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2 (Total: 11 Hired Services)")).toBeVisible();
  });

  it("only exposes Complete/Cancel on eligible Active records; Completed records expose no terminal actions", async () => {
    renderTestApplication({ initialPath: "/admin/hired-services", isAdmin: true });
    const grid = await screen.findByRole("grid", { name: "Hired Service list" });
    expect(within(grid).getByRole("button", { name: "Complete Hired Service 100" })).toBeVisible();
    expect(within(grid).getByRole("button", { name: "Cancel Hired Service 100" })).toBeVisible();
    expect(within(grid).queryByRole("button", { name: "Complete Hired Service 101" })).not.toBeInTheDocument();
    expect(within(grid).queryByRole("button", { name: "Cancel Hired Service 101" })).not.toBeInTheDocument();
  });

  it("completes an Active Hired Service after confirming, refetching evidence first", async () => {
    let puts = 0;
    let putBody: unknown;
    server.use(http.put(hiredServiceUrl("100"), async ({ request }) => {
      puts += 1;
      putBody = await request.json();
      return HttpResponse.json({ content: null });
    }));
    renderTestApplication({ initialPath: "/admin/hired-services", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("grid", { name: "Hired Service list" });
    await user.click(screen.getByRole("button", { name: "Complete Hired Service 100" }));
    const dialog = screen.getByRole("dialog", { name: "Complete Hired Service 100?" });
    await user.click(within(dialog).getByRole("button", { name: "Complete Hired Service 100" }));
    await waitFor(() => expect(puts).toBe(1));
    expect(putBody).toEqual({ hoanThanh: true });
    expect(await screen.findByText("Hired Service 100 completed successfully.")).toBeVisible();
  });

  it("cancels an Active Hired Service after confirming, removing it with no invented history", async () => {
    let deletes = 0;
    server.use(http.delete(hiredServiceUrl("100"), () => { deletes += 1; return HttpResponse.json({ content: null }); }));
    renderTestApplication({ initialPath: "/admin/hired-services/100", isAdmin: true });
    const user = userEvent.setup();
    await heading("Hired Service Detail");
    await user.click(await screen.findByRole("button", { name: "Cancel Hired Service 100" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel Hired Service 100?" });
    expect(screen.getByText(/no cancellation history, reason, or undo/)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Cancel Hired Service 100" }));
    await waitFor(() => expect(deletes).toBe(1));
  });

  it("shows a non-blocking partial relation failure and falls back to numeric identifiers", async () => {
    server.use(http.get(usersUrl, () => HttpResponse.error()));
    renderTestApplication({ initialPath: "/admin/hired-services", isAdmin: true });
    await screen.findByRole("grid", { name: "Hired Service list" });
    const banner = await screen.findByText(/Some Service or User names could not be loaded/);
    expect(banner.closest('[role="status"]')).toHaveAttribute("data-state", "partial-relation-failure");
    expect(screen.getByText("User #5")).toBeVisible();
    expect(screen.getByText("Logo Design Service")).toBeVisible();
  });

  it("distinguishes not-found and forbidden failures", async () => {
    const missing = renderTestApplication({ initialPath: "/admin/hired-services/999999", isAdmin: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("Hired Service not found.");
    missing.unmount();

    server.use(http.get(hiredServicesUrl, () => HttpResponse.json({ message: "forbidden" }, { status: 403 })));
    renderTestApplication({ initialPath: "/admin/hired-services", isAdmin: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("Access forbidden");
  });

  it.each([375, 768, 1440])("keeps Hired Service list and detail actions available at %i px", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    window.dispatchEvent(new Event("resize"));
    const list = renderTestApplication({ initialPath: "/admin/hired-services", isAdmin: true });
    expect(await screen.findByRole("grid", { name: "Hired Service list" })).toBeVisible();
    expect(screen.getByRole("link", { name: "View Hired Service 100" })).toBeVisible();
    list.unmount();

    renderTestApplication({ initialPath: "/admin/hired-services/100", isAdmin: true });
    await heading("Hired Service Detail");
    expect(await screen.findByRole("navigation", { name: "Hired Service detail actions" })).toBeVisible();
  });
});
