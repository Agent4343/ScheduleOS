import { test as setup, expect } from "@playwright/test"
import path from "path"

const authFile = path.join(__dirname, ".auth/user.json")

/**
 * Authentication setup that runs before all authenticated tests.
 * Logs in a test user and saves the session state.
 */
setup("authenticate", async ({ page }) => {
  // Use test credentials from environment or defaults
  const email = process.env.E2E_TEST_EMAIL || "admin@example.com"
  const password = process.env.E2E_TEST_PASSWORD || "Admin123!"

  // Navigate to login page
  await page.goto("/login")

  // Fill in login form
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)

  // Submit form
  await page.getByRole("button", { name: "Sign In" }).click()

  // Wait for redirect to dashboard (indicates successful login)
  await page.waitForURL("**/dashboard**", { timeout: 10000 })

  // Verify we're logged in
  await expect(page).toHaveURL(/.*dashboard.*/)

  // Save authentication state
  await page.context().storageState({ path: authFile })
})
