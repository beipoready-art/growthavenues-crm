import { expect, test } from "@playwright/test";
import { as } from "./helpers";

type Ipo = { id: string; companyName: string; status: string };

test("everyone can browse IPOs; filter by status", async ({ browser }) => {
  const viewer = await as(browser, "viewer");
  await viewer.goto("/ipos");
  await expect(viewer.getByRole("link", { name: "Sahyadri Renewables Ltd" })).toBeVisible();
  await expect(viewer.getByRole("button", { name: "+ New IPO" })).toHaveCount(0);

  await viewer.getByLabel("Statuses").selectOption("UPCOMING");
  await expect(viewer).toHaveURL(/status=UPCOMING/);
  await expect(viewer.getByRole("link", { name: "Kaveri Fintech Ltd" })).toBeVisible();
  await expect(viewer.getByRole("link", { name: "Sahyadri Renewables Ltd" })).toHaveCount(0);

  const open = (await (await viewer.request.get("/api/ipos?status=OPEN")).json()).ipos as Ipo[];
  expect(open.map((i) => i.companyName)).toEqual(["Sahyadri Renewables Ltd"]);
});

test("admin creates and edits an IPO; validation enforced", async ({ browser }) => {
  const admin = await as(browser, "admin");
  await admin.goto("/ipos");
  await admin.getByRole("button", { name: "+ New IPO" }).click();
  const name = `E2E Industries ${Date.now()}`;
  await admin.fill("#ipo-company", name);
  await admin.fill("#ipo-low", "95");
  await admin.fill("#ipo-high", "100");
  await admin.fill("#ipo-lot", "150");
  await admin.fill("#ipo-open", "2026-10-10");
  await admin.fill("#ipo-close", "2026-10-08"); // before open → rejected
  await admin.getByRole("button", { name: "Create IPO" }).click();
  await expect(admin.getByText("Close date must be on or after open date")).toBeVisible();
  await admin.fill("#ipo-close", "2026-10-14");
  await admin.getByRole("button", { name: "Create IPO" }).click();
  await expect(admin.getByRole("heading", { name })).toBeVisible();
  await expect(admin.getByText("₹95 – ₹100")).toBeVisible();
  await expect(admin.getByText("₹15,000")).toBeVisible(); // 150 × ₹100

  await admin.getByRole("button", { name: "Edit IPO" }).click();
  await admin.selectOption("#ipo-status", "OPEN");
  await admin.getByRole("button", { name: "Save changes" }).click();
  await expect(admin.getByText("changed status Upcoming → Open")).toBeVisible();

  // Partial update that would invert the price band is rejected.
  const id = admin.url().split("/").pop();
  const bad = await admin.request.patch(`/api/ipos/${id}`, { data: { priceBandLow: 120 } });
  expect(bad.status()).toBe(400);
});

test("non-admins cannot create or edit IPOs", async ({ browser }) => {
  for (const who of ["rm1", "compliance"] as const) {
    const page = await as(browser, who);
    const ipos = (await (await page.request.get("/api/ipos")).json()).ipos as Ipo[];
    expect((await page.request.patch(`/api/ipos/${ipos[0].id}`, { data: { status: "CLOSED" } })).status()).toBe(403);
    const res = await page.request.post("/api/ipos", {
      data: { companyName: "X", priceBandLow: 1, priceBandHigh: 2, lotSize: 1, openDate: "2026-10-01", closeDate: "2026-10-02", status: "UPCOMING" },
    });
    expect(res.status()).toBe(403);
  }
});
