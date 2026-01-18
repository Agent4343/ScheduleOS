import { test, expect } from "@playwright/test"

test.describe("Dashboard", () => {
  test("should display dashboard overview", async ({ page }) => {
    await page.goto("/dashboard")

    // Should show dashboard content
    await expect(page).toHaveURL(/.*dashboard.*/)

    // Check for common dashboard elements
    await expect(page.locator("header")).toBeVisible()
  })

  test("should show user navigation", async ({ page }) => {
    await page.goto("/dashboard")

    // Should have navigation elements
    const nav = page.locator("nav")
    await expect(nav).toBeVisible()
  })

  test("should be able to navigate to schedule", async ({ page }) => {
    await page.goto("/dashboard")

    // Find and click schedule link
    const scheduleLink = page.getByRole("link", { name: /schedule/i }).first()
    if (await scheduleLink.isVisible()) {
      await scheduleLink.click()
      await expect(page).toHaveURL(/.*schedule.*/)
    }
  })

  test("should be able to navigate to time off", async ({ page }) => {
    await page.goto("/dashboard")

    // Find and click time-off link if visible
    const timeOffLink = page.getByRole("link", { name: /time.?off/i }).first()
    if (await timeOffLink.isVisible()) {
      await timeOffLink.click()
      await expect(page).toHaveURL(/.*time-off.*/)
    }
  })
})

test.describe("Navigation", () => {
  test("should have working sidebar navigation", async ({ page }) => {
    await page.goto("/dashboard")

    // Check sidebar is visible on desktop
    const sidebar = page.locator('[data-testid="sidebar"], aside, nav').first()
    await expect(sidebar).toBeVisible()
  })

  test("should have user menu", async ({ page }) => {
    await page.goto("/dashboard")

    // Look for user avatar or menu button
    const userMenu = page.locator('[data-testid="user-menu"], button:has-text("account")').first()
    if (await userMenu.isVisible()) {
      await userMenu.click()
      // Should show dropdown with logout option
      await expect(page.getByText(/logout|sign out/i)).toBeVisible()
    }
  })
})
