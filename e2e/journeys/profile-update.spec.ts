import { test, expect, seedSession, regularUser } from "../fixtures";

test.describe("Profile update", () => {
  test("edits and saves Profile details", async ({ page }) => {
    await seedSession(page, regularUser);
    await page.goto("/profile");

    await expect(page.getByRole("heading", { name: "Your Profile" })).toBeVisible();
    const phone = page.getByLabel("Phone", { exact: true });
    await phone.fill("+84987654321");
    await page.getByRole("button", { name: "Save Profile" }).click();

    await expect(page.getByRole("status")).toHaveText("Profile saved successfully.");
  });
});
