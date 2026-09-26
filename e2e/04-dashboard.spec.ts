import { expect, test, type Page } from "@playwright/test";
import { as } from "./helpers";

async function tile(page: Page, label: string) {
  const t = page.locator("a", { has: page.getByText(label, { exact: true }) }).first();
  return Number(await t.locator("p").nth(1).textContent());
}

test("admin dashboard shows firm-wide totals and the mandate pipeline", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const clients = (await (await admin.request.get("/api/clients")).json()).total;
  const active = (await (await admin.request.get("/api/mandates")).json()).mandates.length;
  await admin.goto("/");
  await expect(admin.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  expect(await tile(admin, "Client companies")).toBe(clients);
  expect(await tile(admin, "Active mandates")).toBe(active);
  await expect(admin.getByTestId("pipeline-summary")).toContainText("DRHP");
  await expect(admin.getByText("Enquiries by RM")).toBeVisible();
  await expect(admin.getByRole("img", { name: "Enquiries by service" })).toBeVisible();
});

test("RM dashboard is limited to their own records", async ({ browser }) => {
  const rm = await as(browser, "rm1");
  const clients = (await (await rm.request.get("/api/clients")).json()).total;
  const active = (await (await rm.request.get("/api/mandates")).json()).mandates.length;
  await rm.goto("/");
  await expect(rm.getByRole("heading", { name: "My dashboard" })).toBeVisible();
  expect(await tile(rm, "My clients")).toBe(clients);
  expect(await tile(rm, "Active mandates")).toBe(active);
  await expect(rm.getByText("Enquiries by RM")).toHaveCount(0);
  await expect(rm.getByText("Kaveri Agro Foods Ltd")).toHaveCount(0); // Priya's mandate
});
