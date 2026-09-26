import { expect, test } from "@playwright/test";
import { as } from "./helpers";

test("admin sees all RMs, totals and the leaderboard; range presets change the window", async ({ browser }) => {
  const admin = await as(browser, "admin");
  await admin.goto("/performance?range=quarter");
  await expect(admin.getByRole("heading", { name: "RM performance" })).toBeVisible();
  const table = admin.getByTestId("rm-table");
  await expect(table.getByRole("row", { name: /Rohan Sharma/ })).toBeVisible();
  await expect(table.getByRole("row", { name: /Priya Nair/ })).toBeVisible();

  const board = admin.getByTestId("leaderboard").locator("li");
  await expect(board.first()).toContainText("1");
  const first = Number((await board.first().textContent())!.match(/(\d+) conversions?/)![1]);
  const second = Number((await board.nth(1).textContent())!.match(/(\d+) conversions?/)![1]);
  expect(first).toBeGreaterThanOrEqual(second);

  await admin.getByRole("group", { name: "Date range" }).getByRole("button", { name: "This week" }).click();
  await expect(admin).toHaveURL(/range=week/);
  await expect(admin.getByText("This week").first()).toBeVisible();

  // A custom range with no activity shows zeros but keeps the current book size.
  await admin.goto("/performance?range=custom&from=2020-01-01&to=2020-01-31");
  const rohan = admin.getByTestId("rm-table").getByRole("row", { name: /Rohan Sharma/ });
  await expect(rohan.locator("td").nth(1)).toHaveText("0");
  await expect(rohan.locator("td").nth(4)).not.toHaveText("0");
});

test("RM sees only their own performance; compliance has no leaderboard; viewer is blocked", async ({ browser }) => {
  const rm = await as(browser, "rm1");
  await rm.goto("/performance?range=quarter");
  await expect(rm.getByRole("heading", { name: "My performance" })).toBeVisible();
  await expect(rm.getByTestId("my-performance")).toContainText("Clients under management");
  await expect(rm.getByText("Priya Nair")).toHaveCount(0);
  await expect(rm.getByTestId("leaderboard")).toHaveCount(0);

  const co = await as(browser, "compliance");
  await co.goto("/performance");
  await expect(co.getByTestId("rm-table")).toBeVisible();
  await expect(co.getByTestId("leaderboard")).toHaveCount(0);

  const viewer = await as(browser, "viewer");
  await viewer.goto("/performance");
  await expect(viewer).toHaveURL("/forbidden");
});
