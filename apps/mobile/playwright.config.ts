import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: "list",
  use: {
    actionTimeout: 15_000,
    baseURL: "http://localhost:8090",
    viewport: { width: 390, height: 844 },
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec expo start --web --port 8090 --localhost",
    url: "http://localhost:8090",
    env: { EXPO_OFFLINE: "1", CI: "1" },
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
