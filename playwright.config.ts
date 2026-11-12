import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  retries: 0,
  use: { baseURL: "http://localhost:5173", viewport: { width: 1400, height: 850 } },
  webServer: { command: "npm run dev -- --port 5173 --strictPort", url: "http://localhost:5173", reuseExistingServer: true },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 850 } }, testIgnore: /mobile\.spec/ },
    { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1400, height: 850 } }, testIgnore: /mobile\.spec/ },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1400, height: 850 } }, testIgnore: /mobile\.spec/ },
    // Emulated phones. Real-device checks are still a manual step (see docs/TESTING.md).
    { name: "iphone", use: { ...devices["iPhone 13"] }, testMatch: /mobile\.spec/ },
    { name: "pixel", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec/ },
  ],
});
