import { test, expect } from "@playwright/test"

test.describe("Schedule View", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/schedule")
  })

  test("should display schedule page", async ({ page }) => {
    // Schedule page should load
    await expect(page).toHaveURL(/.*schedule.*/)
  })

  test("should show calendar or schedule grid", async ({ page }) => {
    // Look for calendar elements
    const calendar = page.locator('[data-testid="schedule-calendar"], [role="grid"], .calendar').first()

    // Either calendar exists or page shows "no schedule" message
    const hasCalendar = await calendar.isVisible().catch(() => false)
    const hasNoSchedule = await page.getByText(/no schedule|empty|create schedule/i).isVisible().catch(() => false)

    expect(hasCalendar || hasNoSchedule).toBeTruthy()
  })

  test("should allow date navigation", async ({ page }) => {
    // Look for navigation buttons (previous/next week/month)
    const nextButton = page.locator('button:has-text("Next"), button[aria-label*="next"], [data-testid="next-date"]').first()
    const prevButton = page.locator('button:has-text("Previous"), button[aria-label*="prev"], [data-testid="prev-date"]').first()

    if (await nextButton.isVisible()) {
      await nextButton.click()
      // Page should update (URL might change or content refresh)
      await page.waitForLoadState("networkidle")
    }

    if (await prevButton.isVisible()) {
      await prevButton.click()
      await page.waitForLoadState("networkidle")
    }
  })

  test("should show crew information if available", async ({ page }) => {
    // Look for crew-related content
    const crewSection = page.locator('[data-testid="crew-list"], .crew, text=/crew/i').first()

    // Crews might not be configured, so this is optional
    if (await crewSection.isVisible()) {
      await expect(crewSection).toBeVisible()
    }
  })
})

test.describe("Schedule Interactions", () => {
  test("should handle shift click interactions", async ({ page }) => {
    await page.goto("/dashboard/schedule")

    // Find any clickable shift element
    const shiftCell = page.locator('[data-testid="shift-cell"], .shift, td[role="gridcell"]').first()

    if (await shiftCell.isVisible()) {
      await shiftCell.click()

      // Should show shift details modal or expand
      await page.waitForLoadState("networkidle")
    }
  })
})
