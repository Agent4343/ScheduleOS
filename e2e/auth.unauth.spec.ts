import { test, expect } from "@playwright/test"

test.describe("Authentication Pages", () => {
  test.describe("Login Page", () => {
    test("should display login form", async ({ page }) => {
      await page.goto("/login")

      await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
      await expect(page.getByLabel("Email")).toBeVisible()
      await expect(page.getByLabel("Password")).toBeVisible()
      await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible()
    })

    test("should have forgot password link", async ({ page }) => {
      await page.goto("/login")

      const forgotPasswordLink = page.getByRole("link", { name: "Forgot password?" })
      await expect(forgotPasswordLink).toBeVisible()
      await forgotPasswordLink.click()

      await expect(page).toHaveURL(/.*forgot-password.*/)
    })

    test("should have register link", async ({ page }) => {
      await page.goto("/login")

      const registerLink = page.getByRole("link", { name: "Create one" })
      await expect(registerLink).toBeVisible()
      await registerLink.click()

      await expect(page).toHaveURL(/.*register.*/)
    })

    test("should show error for invalid credentials", async ({ page }) => {
      await page.goto("/login")

      await page.getByLabel("Email").fill("invalid@example.com")
      await page.getByLabel("Password").fill("wrongpassword")
      await page.getByRole("button", { name: "Sign In" }).click()

      // Should show error alert
      await expect(page.getByRole("alert")).toBeVisible({ timeout: 5000 })
    })

    test("should show loading state when submitting", async ({ page }) => {
      await page.goto("/login")

      await page.getByLabel("Email").fill("test@example.com")
      await page.getByLabel("Password").fill("password123")

      // Click submit and check for loading spinner
      const submitButton = page.getByRole("button", { name: "Sign In" })
      await submitButton.click()

      // Button should be disabled during submission
      await expect(submitButton).toBeDisabled()
    })
  })

  test.describe("Forgot Password Page", () => {
    test("should display forgot password form", async ({ page }) => {
      await page.goto("/forgot-password")

      await expect(page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible()
      await expect(page.getByLabel("Email")).toBeVisible()
      await expect(page.getByRole("button", { name: "Send Reset Link" })).toBeVisible()
    })

    test("should have back to login link", async ({ page }) => {
      await page.goto("/forgot-password")

      const backLink = page.getByRole("link", { name: "Back to login" })
      await expect(backLink).toBeVisible()
      await backLink.click()

      await expect(page).toHaveURL(/.*login.*/)
    })

    test("should show success message after submitting valid email", async ({ page }) => {
      await page.goto("/forgot-password")

      await page.getByLabel("Email").fill("test@example.com")
      await page.getByRole("button", { name: "Send Reset Link" }).click()

      // Should show success state
      await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 5000 })
      await expect(page.getByText("test@example.com")).toBeVisible()
    })

    test("should allow trying different email after success", async ({ page }) => {
      await page.goto("/forgot-password")

      await page.getByLabel("Email").fill("test@example.com")
      await page.getByRole("button", { name: "Send Reset Link" }).click()

      // Wait for success state
      await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 5000 })

      // Click try different email button
      await page.getByRole("button", { name: "Try a different email" }).click()

      // Should show form again
      await expect(page.getByLabel("Email")).toBeVisible()
    })
  })

  test.describe("Reset Password Page", () => {
    test("should show error for missing token", async ({ page }) => {
      await page.goto("/reset-password")

      await expect(page.getByRole("heading", { name: "Invalid Reset Link" })).toBeVisible()
      await expect(page.getByRole("link", { name: "Request a New Link" })).toBeVisible()
    })

    test("should display reset form with valid token parameter", async ({ page }) => {
      // Note: This uses a fake token - actual token validation happens server-side
      await page.goto("/reset-password?token=test-token-123")

      await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible()
      await expect(page.getByLabel("New Password")).toBeVisible()
      await expect(page.getByLabel("Confirm Password")).toBeVisible()
      await expect(page.getByRole("button", { name: "Reset Password" })).toBeVisible()
    })

    test("should validate password requirements", async ({ page }) => {
      await page.goto("/reset-password?token=test-token-123")

      // Try submitting with short password
      await page.getByLabel("New Password").fill("short")
      await page.getByLabel("Confirm Password").fill("short")
      await page.getByRole("button", { name: "Reset Password" }).click()

      // Should show validation error
      await expect(page.getByRole("alert")).toBeVisible()
      await expect(page.getByText(/8 characters/i)).toBeVisible()
    })

    test("should validate passwords match", async ({ page }) => {
      await page.goto("/reset-password?token=test-token-123")

      await page.getByLabel("New Password").fill("ValidPass123")
      await page.getByLabel("Confirm Password").fill("DifferentPass123")
      await page.getByRole("button", { name: "Reset Password" }).click()

      // Should show mismatch error
      await expect(page.getByRole("alert")).toBeVisible()
      await expect(page.getByText(/do not match/i)).toBeVisible()
    })

    test("should have back to login link", async ({ page }) => {
      await page.goto("/reset-password?token=test-token")

      const backLink = page.getByRole("link", { name: "Back to login" })
      await expect(backLink).toBeVisible()
      await backLink.click()

      await expect(page).toHaveURL(/.*login.*/)
    })
  })
})
