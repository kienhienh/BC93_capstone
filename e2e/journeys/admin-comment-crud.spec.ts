import { test, expect, seedSession, adminUser } from "../fixtures";

test.describe("Representative Administrator CRUD flow (Comments)", () => {
  test("creates a Comment from the Administrator area", async ({ page }) => {
    await seedSession(page, adminUser);
    await page.goto("/admin/comments");

    await expect(page.getByRole("heading", { name: "Comment Management" })).toBeVisible();
    await page.getByRole("link", { name: "Create Comment" }).click();

    await expect(page.getByRole("heading", { name: "Create Comment" })).toBeVisible();
    await page.getByLabel("Service *").selectOption({ label: "Modern Logo Design" });
    await page.getByLabel("Comment content *").fill("Excellent turnaround and communication.");
    await page.getByRole("button", { name: "Create Comment" }).click();

    await expect(page.getByRole("heading", { name: "Comment Management" })).toBeVisible();
    await expect(page.getByText(/created successfully/)).toBeVisible();
  });
});
