import { defineConfig } from "@playwright/test";

// End-to-end tests run against a freshly seeded database:
//   npm run db:seed && npm run test:e2e
// The app runs as a production build started with `npm run start:e2e`, which
// points the Google / Microsoft integrations at the local provider mock.
// (The dev server compiles routes on first hit, which can exceed assertion
// timeouts on a cold run.)
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
  webServer: [
    // Mock Google / Microsoft APIs for the integration specs.
    { command: "node e2e/mocks/provider-mock.mjs", url: "http://localhost:4455/__log", reuseExistingServer: true, timeout: 20_000 },
    ...(process.env.E2E_BASE_URL
      ? []
      : [{ command: "npm run build && npm run start:e2e", url: "http://localhost:3000/login", reuseExistingServer: true, timeout: 300_000 }]),
  ],
});
