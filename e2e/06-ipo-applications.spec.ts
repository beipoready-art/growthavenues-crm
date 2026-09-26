import { expect, test, type Page } from "@playwright/test";
import { as } from "./helpers";

async function find(page: Page, api: "clients" | "ipos", q: string) {
  const data = await (await page.request.get(`/api/${api}?q=${encodeURIComponent(q)}`)).json();
  return data[api][0] as { id: string };
}

test("RM logs an IPO application from the client profile; amount defaults to cut-off", async ({ browser }) => {
  const rm = await as(browser, "rm2");
  const arjun = await find(rm, "clients", "Arjun Kapoor");
  await rm.goto(`/clients/${arjun.id}`);
  await rm.getByRole("button", { name: "+ Log application" }).click();
  await rm.selectOption("#la-ipo", { label: "Sahyadri Renewables Ltd (open)" });
  await rm.fill("#la-lots", "3");
  await expect(rm.getByText("Calculated at cut-off: ₹45,000")).toBeVisible(); // 3 × 50 × ₹300
  await rm.getByRole("button", { name: "Log application", exact: true }).click();
  const row = rm.getByRole("row", { name: /Sahyadri Renewables Ltd/ });
  await expect(row).toContainText("₹45,000");
  await expect(row).toContainText("Applied");

  // Duplicate application for the same IPO is refused.
  const ipo = await find(rm, "ipos", "Sahyadri");
  const dup = await rm.request.post("/api/ipo-applications", { data: { ipoId: ipo.id, clientId: arjun.id, lotsApplied: 1, applicationDate: "2026-09-26" } });
  expect(dup.status()).toBe(409);

  // Partially allotted requires a valid lot count (server-side check).
  const apps = (await (await rm.request.get(`/api/ipo-applications?clientId=${arjun.id}&ipoId=${ipo.id}`)).json()).applications;
  const bad = await rm.request.patch(`/api/ipo-applications/${apps[0].id}`, { data: { status: "PARTIALLY_ALLOTTED", lotsAllotted: 3 } });
  expect((await bad.json()).error).toMatch(/between 1 and 2/);

  await row.getByRole("button", { name: "Update" }).click();
  await rm.selectOption("#au-status", "PARTIALLY_ALLOTTED");
  await rm.fill("#au-allotted", "1");
  await rm.getByRole("button", { name: "Save" }).click();
  await expect(row).toContainText("1 / 3");
  await expect(row).toContainText("Partially Allotted");
});

test("applications require verified KYC and an open/closed IPO", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const kavita = await find(admin, "clients", "Kavita Reddy"); // KYC pending
  const suresh = await find(admin, "clients", "Suresh Patel");
  const open = await find(admin, "ipos", "Sahyadri");
  const upcoming = await find(admin, "ipos", "Kaveri");

  const r1 = await admin.request.post("/api/ipo-applications", { data: { ipoId: open.id, clientId: kavita.id, lotsApplied: 1, applicationDate: "2026-09-26" } });
  expect(r1.status()).toBe(400);
  expect((await r1.json()).error).toMatch(/KYC must be verified/);
  const r2 = await admin.request.post("/api/ipo-applications", { data: { ipoId: upcoming.id, clientId: suresh.id, lotsApplied: 1, applicationDate: "2026-09-26" } });
  expect(r2.status()).toBe(400);

  await admin.goto(`/clients/${kavita.id}`);
  await expect(admin.getByRole("button", { name: "+ Log application" })).toBeDisabled();
});

test("IPO page lists applicants (scoped for RMs) with summary and follow-up list", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const listed = await find(admin, "ipos", "Nilgiri");
  await admin.goto(`/ipos/${listed.id}`);
  await expect(admin.getByRole("link", { name: "Suresh Patel" })).toBeVisible();
  await expect(admin.getByRole("link", { name: "Arjun Kapoor" })).toBeVisible();
  await expect(admin.getByText("Partially Allotted · 1")).toBeVisible();
  await expect(admin.getByText("Refunded · 1")).toBeVisible();

  const rm = await as(browser, "rm1");
  await rm.goto(`/ipos/${listed.id}`);
  await expect(rm.getByRole("link", { name: "Suresh Patel" })).toBeVisible();
  await expect(rm.getByRole("link", { name: "Arjun Kapoor" })).toHaveCount(0);

  // Upcoming IPO: verified clients who haven't applied are listed for follow-up.
  const upcoming = await find(admin, "ipos", "Kaveri");
  await admin.goto(`/ipos/${upcoming.id}`);
  await expect(admin.getByTestId("not-applied").getByText("Suresh Patel")).toBeVisible();

  // Other RM cannot update Rohan's client's application.
  const apps = (await (await admin.request.get(`/api/ipo-applications?ipoId=${listed.id}`)).json()).applications as { id: string; client: { name: string } }[];
  const surehApp = apps.find((a) => a.client.name === "Suresh Patel")!;
  const rm2 = await as(browser, "rm2");
  expect((await rm2.request.patch(`/api/ipo-applications/${surehApp.id}`, { data: { status: "REFUNDED" } })).status()).toBe(404);
  const co = await as(browser, "compliance");
  expect((await co.request.patch(`/api/ipo-applications/${surehApp.id}`, { data: { status: "REFUNDED" } })).status()).toBe(403);
});

test("dashboard shows IPO subscription summary", async ({ browser }) => {
  const admin = await as(browser, "admin");
  await admin.goto("/");
  const summary = admin.getByTestId("ipo-summary");
  await expect(summary.getByRole("row", { name: /Nilgiri Foods Ltd/ })).toContainText("₹58,752"); // 3×34×432 + 34×432
  await expect(summary.getByRole("row", { name: /Kaveri Fintech Ltd/ })).toContainText("Upcoming");

  const rm = await as(browser, "rm1");
  await rm.goto("/");
  await expect(rm.getByTestId("ipo-summary").getByRole("row", { name: /Nilgiri Foods Ltd/ })).toContainText("₹44,064"); // only Suresh
});
