import { expect, test } from "@playwright/test";
import { as } from "./helpers";

type LeadRow = { id: string; name: string; status: string; source: string; assignedRm: { id: string; name: string } | null };

test("RM sees only their own leads", async ({ browser }) => {
  const rm = await as(browser, "rm1");
  const { leads } = (await (await rm.request.get("/api/leads")).json()) as { leads: LeadRow[] };
  expect(leads.length).toBeGreaterThan(0);
  for (const l of leads) expect(l.assignedRm?.name).toBe("Rohan Sharma");

  // Another RM's lead is invisible (404), including direct URL access.
  const admin = await as(browser, "admin");
  const other = ((await (await admin.request.get("/api/leads?q=Rajesh")).json()) as { leads: LeadRow[] }).leads[0];
  expect(other.assignedRm?.name).toBe("Priya Nair");
  expect((await rm.request.get(`/api/leads/${other.id}`)).status()).toBe(404);
  await rm.goto(`/leads/${other.id}`);
  await expect(rm.getByText("Page not found")).toBeVisible();
});

test("filters: status, source, RM, date range and search", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const get = async (qs: string) => ((await (await admin.request.get(`/api/leads?${qs}`)).json()) as { leads: LeadRow[] }).leads;
  expect((await get("status=CONVERTED")).every((l) => l.status === "CONVERTED")).toBe(true);
  expect((await get("source=WEBSITE")).every((l) => l.source === "WEBSITE")).toBe(true);
  expect((await get("rm=unassigned")).map((l) => l.name)).toContain("Farhan Qureshi");
  expect(await get("from=2000-01-01&to=2000-01-02")).toHaveLength(0);
  expect((await get("q=sneha")).map((l) => l.name)).toEqual(["Sneha Kulkarni"]);

  // UI filter updates the URL and the table.
  await admin.goto("/leads");
  await admin.getByLabel("Statuses").selectOption("LOST");
  await expect(admin).toHaveURL(/status=LOST/);
  await expect(admin.getByRole("link", { name: "Meera Joshi" })).toBeVisible();
  await expect(admin.getByRole("link", { name: "Ankit Verma" })).toHaveCount(0);
});

test("RM creates a lead (auto-assigned) and updates its status with history", async ({ browser }) => {
  const rm = await as(browser, "rm1");
  await rm.goto("/leads");
  await rm.getByRole("button", { name: "+ New lead" }).click();
  const name = `E2E Lead ${Date.now()}`;
  await rm.fill("#lf-name", name);
  await rm.fill("#lf-phone", "+91 90000 00001");
  await rm.selectOption("#lf-source", "WEBSITE");
  await expect(rm.locator("#lf-rm")).toHaveCount(0); // RMs cannot pick an assignee
  await rm.getByRole("button", { name: "Create lead" }).click();
  await expect(rm.getByRole("heading", { name })).toBeVisible();
  await expect(rm.getByText("Rohan Sharma").first()).toBeVisible();

  await rm.getByRole("button", { name: "Edit", exact: true }).click();
  await rm.selectOption("#lf-status", "CONTACTED");
  await rm.getByRole("button", { name: "Save changes" }).click();
  await expect(rm.getByText("changed status New → Contacted")).toBeVisible();
});

test("viewer and compliance are read-only on leads", async ({ browser }) => {
  for (const who of ["viewer", "compliance"] as const) {
    const page = await as(browser, who);
    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ New lead" })).toHaveCount(0);
    const res = await page.request.post("/api/leads", { data: { name: "X Y", phone: "+91 90000 00000", source: "OTHER" } });
    expect(res.status()).toBe(403);
  }
});

test("admin can reassign and delete leads; RM cannot reassign", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const { lead } = await (await admin.request.post("/api/leads", { data: { name: "Temp Lead", phone: "+91 90000 00002", source: "OTHER" } })).json();
  const rohan = ((await (await admin.request.get("/api/leads?q=Ankit")).json()) as { leads: LeadRow[] }).leads[0].assignedRm!;
  expect((await admin.request.patch(`/api/leads/${lead.id}`, { data: { assignedRmId: rohan.id } })).status()).toBe(200);

  const rm = await as(browser, "rm1");
  expect((await rm.request.patch(`/api/leads/${lead.id}`, { data: { assignedRmId: null } })).status()).toBe(403);
  expect((await rm.request.delete(`/api/leads/${lead.id}`)).status()).toBe(403);

  expect((await admin.request.delete(`/api/leads/${lead.id}`)).status()).toBe(200);
});
