import { test, expect, seedSession, regularUser } from "../fixtures";

test.describe("Hire and Hired Service management", () => {
  test("confirms a Hire and sees it listed under Hired Services", async ({ page, mockApi }) => {
    await seedSession(page, regularUser);
    await page.goto("/services/1/hire");

    await expect(page.getByRole("heading", { name: "Confirm your Hire" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm Hire" }).click();

    await expect(page).toHaveURL("/hired-services");
    await expect(page.getByText("Modern Logo Design was hired successfully.")).toBeVisible();
    await expect(page.getByRole("article", { name: "Modern Logo Design" })).toBeVisible();
    await expect(page.getByText("In progress")).toBeVisible();
    expect(mockApi.hiredServices).toHaveLength(1);
  });
});
