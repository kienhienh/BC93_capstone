import { test, expect, SESSION_STORAGE_KEY, makeToken, regularUser } from "../fixtures";

const persistedUser = {
  id: String(regularUser.id),
  name: regularUser.name,
  email: regularUser.email,
  role: regularUser.role,
  avatar: regularUser.avatar,
};

test.describe("Expired and forbidden Session handling", () => {
  test("redirects to Login once a persisted Session has already expired", async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [
        SESSION_STORAGE_KEY,
        JSON.stringify({ token: makeToken(Math.floor(Date.now() / 1000) - 60), user: persistedUser }),
      ],
    );

    await page.goto("/orders");

    await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
  });

  test("shows an Insufficient permission state for a non-Administrator visiting an Admin route", async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [SESSION_STORAGE_KEY, JSON.stringify({ token: makeToken(4_102_444_800), user: persistedUser })],
    );

    await page.goto("/admin/users");

    await expect(page.getByRole("heading", { name: "Insufficient permission" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Login" })).not.toBeVisible();
  });
});
