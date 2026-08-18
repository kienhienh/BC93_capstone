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
const users = [
  { id: 5, name: "Ada Lovelace" },
  { id: 10, name: "Sam Seller" },
];
const hiredActive = { id: 100, maCongViec: 1, maNguoiThue: 5, ngayThue: "2025-01-01", hoanThanh: false };

function defaults(current = hiredActive) {
  server.use(
    http.get(hiredServicesUrl, () => HttpResponse.json({ content: [current] })),
    http.get(servicesUrl, () => HttpResponse.json({ content: [serviceOne] })),
    http.get(usersUrl, () => HttpResponse.json({ content: users })),
  );
}

describe("Administrator Hired Service safeguards", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    defaults();
  });

  it("blocks a stale Complete with Reload latest and sends no PUT when the record changed after loading", async () => {
    let puts = 0;
    let gets = 0;
    server.use(
      http.get(hiredServicesUrl, () => {
        gets += 1;
        return HttpResponse.json({ content: [gets === 1 ? hiredActive : { ...hiredActive, hoanThanh: true }] });
      }),
      http.put(hiredServiceUrl("100"), () => { puts += 1; return HttpResponse.json({ content: null }); }),
    );
    renderTestApplication({ initialPath: "/admin/hired-services/100", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Hired Service Detail" });
    await user.click(await screen.findByRole("button", { name: "Complete Hired Service 100" }));
    const dialog = screen.getByRole("dialog", { name: "Complete Hired Service 100?" });
    await user.click(within(dialog).getByRole("button", { name: "Complete Hired Service 100" }));
    const stale = await screen.findByRole("alert");
    expect(stale).toHaveAttribute("data-state", "stale");
    expect(within(stale).getByRole("button", { name: "Reload latest" })).toBeVisible();
    expect(puts).toBe(0);
  });

  it("blocks a stale Cancel with Reload latest and sends no DELETE when the record is already gone", async () => {
    let deletes = 0;
    let gets = 0;
    server.use(
      http.get(hiredServicesUrl, () => {
        gets += 1;
        return HttpResponse.json({ content: gets === 1 ? [hiredActive] : [] });
      }),
      http.delete(hiredServiceUrl("100"), () => { deletes += 1; return HttpResponse.json({ content: null }); }),
    );
    renderTestApplication({ initialPath: "/admin/hired-services/100", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Hired Service Detail" });
    await user.click(await screen.findByRole("button", { name: "Cancel Hired Service 100" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel Hired Service 100?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel Hired Service 100" }));
    const stale = await screen.findByRole("alert");
    expect(stale).toHaveAttribute("data-state", "stale");
    expect(deletes).toBe(0);
  });

  it("reconciles an unknown Complete outcome without resubmitting the mutation", async () => {
    let puts = 0;
    let evidence = hiredActive;
    server.use(
      http.get(hiredServicesUrl, () => HttpResponse.json({ content: [evidence] })),
      http.put(hiredServiceUrl("100"), () => {
        puts += 1;
        evidence = { ...evidence, hoanThanh: true };
        return HttpResponse.error();
      }),
    );
    renderTestApplication({ initialPath: "/admin/hired-services/100", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Hired Service Detail" });
    await user.click(await screen.findByRole("button", { name: "Complete Hired Service 100" }));
    const dialog = screen.getByRole("dialog", { name: "Complete Hired Service 100?" });
    await user.click(within(dialog).getByRole("button", { name: "Complete Hired Service 100" }));
    await waitFor(() => expect(screen.getByText("Hired Service 100 completed successfully.")).toBeVisible());
    expect(puts).toBe(1);
  });

  it("reconciles an unknown Cancel outcome without resubmitting DELETE", async () => {
    let deletes = 0;
    let evidence: (typeof hiredActive)[] = [hiredActive];
    server.use(
      http.get(hiredServicesUrl, () => HttpResponse.json({ content: evidence })),
      http.delete(hiredServiceUrl("100"), () => { deletes += 1; evidence = []; return HttpResponse.error(); }),
    );
    const app = renderTestApplication({ initialPath: "/admin/hired-services/100", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Hired Service Detail" });
    await user.click(await screen.findByRole("button", { name: "Cancel Hired Service 100" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel Hired Service 100?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel Hired Service 100" }));
    await waitFor(() => expect(app.currentLocation()).toBe("/admin/hired-services"));
    expect(deletes).toBe(1);
  });

  it.each([
    ["Complete", "Complete Hired Service 100?"],
    ["Cancel", "Cancel Hired Service 100?"],
  ])("focuses the least destructive action (Go back) first in the %s dialog", async (action, dialogName) => {
    renderTestApplication({ initialPath: "/admin/hired-services/100", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Hired Service Detail" });
    const trigger = await screen.findByRole("button", { name: `${action} Hired Service 100` });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: dialogName });
    expect(within(dialog).getByRole("button", { name: "Go back" })).toHaveFocus();
  });

  it.each([375, 768, 1440])("keeps destructive confirmation keyboard-safe at %i px", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    window.dispatchEvent(new Event("resize"));
    renderTestApplication({ initialPath: "/admin/hired-services/100", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Hired Service Detail" });
    const trigger = await screen.findByRole("button", { name: "Cancel Hired Service 100" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Cancel Hired Service 100?" });
    const cancel = within(dialog).getByRole("button", { name: "Go back" });
    expect(cancel).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("traps Tab focus within the destructive confirmation dialog", async () => {
    renderTestApplication({ initialPath: "/admin/hired-services/100", isAdmin: true });
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Hired Service Detail" });
    await user.click(await screen.findByRole("button", { name: "Cancel Hired Service 100" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel Hired Service 100?" });
    const cancel = within(dialog).getByRole("button", { name: "Go back" });
    const confirm = within(dialog).getByRole("button", { name: "Cancel Hired Service 100" });
    expect(cancel).toHaveFocus();

    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();

    await user.tab();
    expect(cancel).toHaveFocus();
  });
});
