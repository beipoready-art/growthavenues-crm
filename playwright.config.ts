import { defineConfig } from "@playwright/test";

// End-to-end tests run against a freshly seeded database:
//   npm run db:seed && npm run test:e2e
// Prefer a production server (`npm run build && npm start`, then
// E2E_BASE_URL=http://localhost:3000): the dev server compiles routes on
// first hit, which can exceed assertion timeouts on a cold run.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1280, height: 800 },
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: "http://localhost:3000/login", reuseExistingServer: true, timeout: 120_000 },
});
