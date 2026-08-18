import { test, expect } from "../fixtures";

test.describe("Sign-in with a safe return destination", () => {
  test("redirects to Login and returns to the originally requested protected route", async ({ page }) => {
    await page.goto("/services/1/hire");

    await expect(page).toHaveURL(/\/login\?returnTo=%2Fservices%2F1%2Fhire/);
    await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();

    await page.getByRole("textbox", { name: "Email" }).fill("alex@example.com");
    await page.getByLabel("Password", { exact: false }).fill("secret1");
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL("/services/1/hire");
    await expect(page.getByRole("heading", { name: "Confirm your Hire" })).toBeVisible();
  });

  test("falls back to Home when the return destination is external", async ({ page }) => {
    await page.goto("/login?returnTo=https%3A%2F%2Fevil.example");

    await page.getByRole("textbox", { name: "Email" }).fill("alex@example.com");
    await page.getByLabel("Password", { exact: false }).fill("secret1");
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: "Find the perfect freelance services for your business" }),
    ).toBeVisible();
  });
});
