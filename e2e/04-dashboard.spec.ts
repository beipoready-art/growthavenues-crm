import { expect, test, type Page } from "@playwright/test";
import { as } from "./helpers";

async function tile(page: Page, label: string) {
  const t = page.locator("a", { has: page.getByText(label, { exact: true }) }).first();
  return Number(await t.locator("p").nth(1).textContent());
}

test("admin dashboard shows firm-wide totals", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const leads = (await (await admin.request.get("/api/leads")).json()).total;
  const clients = (await (await admin.request.get("/api/clients")).json()).total;
  await admin.goto("/");
  await expect(admin.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  expect(await tile(admin, "Total leads")).toBe(leads);
  expect(await tile(admin, "Total clients")).toBe(clients);
  await expect(admin.getByText("Leads by RM")).toBeVisible();
  await expect(admin.getByRole("img", { name: "Leads by source" })).toBeVisible();
});

test("RM dashboard is limited to their own records", async ({ browser }) => {
  const rm = await as(browser, "rm1");
  const leads = (await (await rm.request.get("/api/leads")).json()).total;
  const clients = (await (await rm.request.get("/api/clients")).json()).total;
  await rm.goto("/");
  await expect(rm.getByRole("heading", { name: "My dashboard" })).toBeVisible();
  expect(await tile(rm, "My leads")).toBe(leads);
  expect(await tile(rm, "My clients")).toBe(clients);
  await expect(rm.getByText("Leads by RM")).toHaveCount(0);
  await expect(rm.getByText("Priya Nair")).toHaveCount(0);
});
