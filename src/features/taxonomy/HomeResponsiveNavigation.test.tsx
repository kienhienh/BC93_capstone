import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderTestApplication } from "../../test/render-application";

function useViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  window.dispatchEvent(new Event("resize"));
}

describe("Home responsive taxonomy navigation", () => {
  it("reveals desktop Search and Categories only after leaving Home through Search", async () => {
    useViewport(1440);
    const user = userEvent.setup();
    renderTestApplication("/");

    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    expect(screen.queryByRole("searchbox", { name: "Search services" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Service Categories" })).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search services from Home" }), "html");
    await user.click(screen.getByRole("button", { name: "Search from Home" }));

    expect(await screen.findByRole("searchbox", { name: "Search services" })).toBeVisible();
    const categories = screen.getByRole("navigation", { name: "Service Categories" });
    expect(await within(categories).findByRole("link", { name: "Graphics & Design" })).toHaveAttribute(
      "href",
      "/categories/1",
    );
    expect(screen.queryByRole("button", { name: "Browse categories" })).not.toBeInTheDocument();
  });

  it("uses an accessible Category drawer on tablet", async () => {
    useViewport(768);
    const user = userEvent.setup();
    renderTestApplication("/services");
    const opener = screen.getByRole("button", { name: "Browse categories" });

    await user.click(opener);

    const drawer = screen.getByRole("dialog", { name: "Service Categories" });
    const close = within(drawer).getByRole("button", { name: "Close categories" });
    await waitFor(() => expect(close).toHaveFocus());
    const category = await within(drawer).findByRole("link", { name: "Graphics & Design" });
    expect(document.getElementById("application-content")).toHaveAttribute("inert");

    await user.tab({ shift: true });
    expect(category).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.click(close);
    expect(screen.queryByRole("dialog", { name: "Service Categories" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();

    await user.click(opener);
    expect(screen.getByRole("dialog", { name: "Service Categories" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Service Categories" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("uses compact Search and menu controls on phone", async () => {
    useViewport(375);
    const user = userEvent.setup();
    renderTestApplication("/services");

    expect(screen.getByRole("button", { name: "Search services" })).toBeVisible();
    const opener = screen.getByRole("button", { name: "Open menu" });
    await user.click(opener);

    expect(screen.getByRole("dialog", { name: "Marketplace menu" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Service Categories" })).not.toBeInTheDocument();
  });
});
