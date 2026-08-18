import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "../fixtures";

test.describe("Public discovery and Service detail", () => {
  test("browses the catalog and opens a Service detail page", async ({ page, mockApi }) => {
    await page.goto("/services");
    await expect(page.getByRole("heading", { name: "All Services" })).toBeVisible();

    await page.getByRole("link", { name: /Modern Logo Design/ }).first().click();
    await expect(page.getByRole("heading", { name: "Modern Logo Design" })).toBeVisible();
    await expect(page.getByText("Delivered exactly what I needed.")).toBeVisible();

    const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
    expect(results.violations).toEqual([]);
    expect(mockApi.unmatched).toEqual([]);
  });
});
