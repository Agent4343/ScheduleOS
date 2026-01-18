import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright E2E Test Configuration
 *
 * Run tests with: npx playwright test
 * Run in UI mode: npx playwright test --ui
 * Run specific test: npx playwright test auth.spec.ts
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["list"],
    ...(process.env.CI ? [["github"] as const] : []),
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },

  projects: [
    // Setup project to authenticate before tests
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },

    // Desktop browsers
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },

    // Mobile browsers
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "mobile-safari",
      use: {
        ...devices["iPhone 12"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },

    // Unauthenticated tests (login, register, forgot password)
    {
      name: "unauthenticated",
      testMatch: /.*\.unauth\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Run local dev server before tests if not in CI
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
})
