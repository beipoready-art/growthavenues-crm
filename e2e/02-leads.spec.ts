import { expect, test } from "@playwright/test";
import { as } from "./helpers";

type LeadRow = { id: string; companyName: string; name: string; status: string; source: string; serviceInterest: string | null; assignedRm: { id: string; name: string } | null };

test("RM sees only their own enquiries", async ({ browser }) => {
  const rm = await as(browser, "rm1");
  const { leads } = (await (await rm.request.get("/api/leads")).json()) as { leads: LeadRow[] };
  expect(leads.length).toBeGreaterThan(0);
  for (const l of leads) expect(l.assignedRm?.name).toBe("Rohan Sharma");

  // Another RM's enquiry is invisible (404), including direct URL access.
  const admin = await as(browser, "admin");
  const other = ((await (await admin.request.get("/api/leads?q=Iyer Precision")).json()) as { leads: LeadRow[] }).leads[0];
  expect(other.assignedRm?.name).toBe("Priya Nair");
  expect((await rm.request.get(`/api/leads/${other.id}`)).status()).toBe(404);
  await rm.goto(`/leads/${other.id}`);
  await expect(rm.getByText("Page not found")).toBeVisible();
});

test("filters: status, source, service, RM, date range and search (company or contact)", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const get = async (qs: string) => ((await (await admin.request.get(`/api/leads?${qs}`)).json()) as { leads: LeadRow[] }).leads;
  expect((await get("status=CONVERTED")).every((l) => l.status === "CONVERTED")).toBe(true);
  expect((await get("source=READINESS_CALL")).every((l) => l.source === "READINESS_CALL")).toBe(true);
  expect((await get("service=MAINBOARD_IPO")).every((l) => l.serviceInterest === "MAINBOARD_IPO")).toBe(true);
  expect((await get("rm=unassigned")).map((l) => l.companyName)).toContain("Qureshi Cold Chain Pvt Ltd");
  expect(await get("from=2000-01-01&to=2000-01-02")).toHaveLength(0);
  expect((await get("q=sneha")).map((l) => l.companyName)).toEqual(["Kulkarni Agritech Pvt Ltd"]);
  expect((await get("q=agritech")).map((l) => l.name)).toEqual(["Sneha Kulkarni"]);

  // UI filter updates the URL and the table.
  await admin.goto("/leads");
  await admin.getByLabel("Statuses").selectOption("LOST");
  await expect(admin).toHaveURL(/status=LOST/);
  await expect(admin.getByRole("link", { name: "Joshi Home Décor LLP" })).toBeVisible();
  await expect(admin.getByRole("link", { name: "Vardhaman Polymers Pvt Ltd" })).toHaveCount(0);
});

test("RM creates a company enquiry (auto-assigned) and moves it along with history", async ({ browser }) => {
  const rm = await as(browser, "rm1");
  await rm.goto("/leads");
  await rm.getByRole("button", { name: "+ New enquiry" }).click();
  const company = `E2E Industries ${Date.now()} Pvt Ltd`;
  await rm.fill("#lf-company", company);
  await rm.fill("#lf-name", "Ravi Kumar");
  await rm.fill("#lf-designation", "Promoter");
  await rm.fill("#lf-phone", "+91 90000 00001");
  await rm.fill("#lf-sector", "Chemicals");
  await rm.selectOption("#lf-service", "SME_IPO");
  await rm.fill("#lf-revenue", "35");
  await rm.selectOption("#lf-source", "READINESS_CALL");
  await expect(rm.locator("#lf-rm")).toHaveCount(0); // RMs cannot pick an assignee
  await rm.getByRole("button", { name: "Create enquiry" }).click();
  await expect(rm.getByRole("heading", { name: company })).toBeVisible();
  await expect(rm.getByText("SME IPO Advisory")).toBeVisible();
  await expect(rm.getByText("₹35 Cr")).toBeVisible();

  await rm.getByRole("button", { name: "Edit", exact: true }).click();
  await rm.selectOption("#lf-status", "DISCOVERY");
  await rm.getByRole("button", { name: "Save changes" }).click();
  await expect(rm.getByText("changed status New → Discovery call")).toBeVisible();
});

test("website IPO-ready check answers are shown on the enquiry", async ({ browser }) => {
  const rm = await as(browser, "rm1");
  const lead = ((await (await rm.request.get("/api/leads?q=Kulkarni")).json()) as { leads: LeadRow[] }).leads[0];
  await rm.goto(`/leads/${lead.id}`);
  await expect(rm.getByText("62 / 100")).toBeVisible();
  await expect(rm.getByTestId("readiness-answers")).toContainText("Audited financials (3 years)");
});

test("viewer and compliance are read-only on enquiries", async ({ browser }) => {
  for (const who of ["viewer", "compliance"] as const) {
    const page = await as(browser, who);
    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ New enquiry" })).toHaveCount(0);
    const res = await page.request.post("/api/leads", { data: { companyName: "X Ltd", name: "X Y", phone: "+91 90000 00000", source: "OTHER" } });
    expect(res.status()).toBe(403);
  }
});

test("admin can reassign and delete enquiries; RM cannot", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const { lead } = await (await admin.request.post("/api/leads", { data: { companyName: "Temp Co Pvt Ltd", name: "Temp Lead", phone: "+91 90000 00002", source: "OTHER" } })).json();
  const rohan = ((await (await admin.request.get("/api/leads?q=Vardhaman")).json()) as { leads: LeadRow[] }).leads[0].assignedRm!;
  expect((await admin.request.patch(`/api/leads/${lead.id}`, { data: { assignedRmId: rohan.id } })).status()).toBe(200);

  const rm = await as(browser, "rm1");
  expect((await rm.request.patch(`/api/leads/${lead.id}`, { data: { assignedRmId: null } })).status()).toBe(403);
  expect((await rm.request.delete(`/api/leads/${lead.id}`)).status()).toBe(403);

  expect((await admin.request.delete(`/api/leads/${lead.id}`)).status()).toBe(200);
});
