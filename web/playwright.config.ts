import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  workers: 2,
  timeout: 120_000,
  reporter: process.env.CI ? "github" : "list",
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:4177",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "phone-chrome", use: { browserName: "chromium" } }],
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 4177 --strictPort",
    url: "http://127.0.0.1:4177",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
