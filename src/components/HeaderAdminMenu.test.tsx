import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { renderTestApplication } from "../test/render-application";

describe("Administrator header account menu", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    window.dispatchEvent(new Event("resize"));
  });

  it("matches the Admin avatar/caret layout and closes the dropdown with Escape", async () => {
    const user = userEvent.setup();
    renderTestApplication({ initialPath: "/services", isAdmin: true });

    expect(await screen.findByRole("link", { name: "Administrator" })).toHaveTextContent("Admin");
    // Wait for the routed Service Discovery content (now lazy-loaded) to finish
    // mounting and running its own heading-focus effect before interacting,
    // otherwise that effect can steal focus back from the trigger below.
    await screen.findByRole("heading", { name: "All Services" });
    const trigger = screen.getByRole("button", { name: "Open Admin account menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "Admin account menu" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: /Your Profile.*CTRL\+O/i })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: /Logout/i })).toBeVisible();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "Admin account menu" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("opens profile from Your Profile and from the Ctrl+O shortcut", async () => {
    const user = userEvent.setup();
    const clickNavigation = renderTestApplication({ initialPath: "/services", isAdmin: true });

    await user.click(await screen.findByRole("button", { name: "Open Admin account menu" }));
    await user.click(screen.getByRole("menuitem", { name: /Your Profile.*CTRL\+O/i }));
    expect(clickNavigation.currentLocation()).toBe("/profile");
    clickNavigation.unmount();

    const shortcutNavigation = renderTestApplication({ initialPath: "/services", isAdmin: true });
    await user.keyboard("{Control>}o{/Control}");
    expect(shortcutNavigation.currentLocation()).toBe("/profile");
  });

  it("logs the Administrator out from the dropdown", async () => {
    const user = userEvent.setup();
    const application = renderTestApplication({ initialPath: "/services", isAdmin: true });

    await user.click(await screen.findByRole("button", { name: "Open Admin account menu" }));
    await user.click(screen.getByRole("menuitem", { name: /Logout/i }));

    expect(application.currentLocation()).toBe("/");
    expect(screen.queryByRole("button", { name: "Open Admin account menu" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Login" })).toBeVisible();
  });
});
