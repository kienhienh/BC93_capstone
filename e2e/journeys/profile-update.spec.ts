import { test, expect, seedSession, regularUser } from "../fixtures";

test.describe("Profile update", () => {
  test("keeps a long Profile email inside a 320px viewport", async ({ page, mockApi }) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await seedSession(page, regularUser);
    mockApi.use("GET", /[/]users[/]700$/, (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        content: {
          ...regularUser,
          email: "GDfDCu00525050-long-unbroken-address@gmail.com",
        },
      }),
    }));

    await page.goto("/profile");

    const email = page.getByText("GDfDCu00525050-long-unbroken-address@gmail.com");
    await expect(email).toBeVisible();
    const viewport = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    const overflowers = await page.locator("body *").evaluateAll((elements, clientWidth) => elements
      .map((element) => ({
        className: element.className,
        right: Math.round(element.getBoundingClientRect().right),
        scrollWidth: element.scrollWidth,
        tagName: element.tagName,
      }))
      .filter((element) => element.right > clientWidth), viewport.clientWidth);
    expect(viewport.scrollWidth, JSON.stringify(overflowers)).toBeLessThanOrEqual(viewport.clientWidth);
  });

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
