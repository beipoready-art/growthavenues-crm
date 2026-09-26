import { expect, test, type Page } from "@playwright/test";
import { as } from "./helpers";

type Mandate = { id: string; code: string; title: string; stage: string; client: { name: string } };

async function clientId(page: Page, q: string) {
  return ((await (await page.request.get(`/api/clients?q=${encodeURIComponent(q)}`)).json()).clients[0] as { id: string }).id;
}
async function mandates(page: Page, qs = "status=all") {
  return (await (await page.request.get(`/api/mandates?${qs}`)).json()).mandates as Mandate[];
}

test("RM opens a mandate from the client page with a fee estimate, then moves it through stages", async ({ browser }) => {
  const rm = await as(browser, "rm1");
  await rm.goto(`/clients/${await clientId(rm, "Sahyadri")}`);
  await rm.getByRole("button", { name: "+ New mandate" }).click();
  await rm.fill("#mf-title", "Post-IPO QIP readiness");
  await rm.selectOption("#mf-service", "FUND_RAISING");
  await expect(rm.locator("#mf-board")).toHaveValue("NOT_APPLICABLE");
  await rm.fill("#mf-size", "10");
  await rm.fill("#mf-retainer", "300000");
  await rm.fill("#mf-pct", "2");
  await expect(rm.getByTestId("fee-estimate")).toContainText("₹23,00,000"); // 3L + 2% of ₹10 Cr
  await rm.getByRole("button", { name: "Create mandate" }).click();

  await expect(rm).toHaveURL(/\/mandates\/[a-z0-9]+$/);
  await expect(rm.getByRole("heading", { name: "Post-IPO QIP readiness" })).toBeVisible();
  await expect(rm.getByText(/BIR-\d{4}-\d{3}/).first()).toBeVisible();
  const id = rm.url().split("/").pop()!;

  // Next stage is suggested; move with a note.
  await expect(rm.locator("#sm-to")).toHaveValue("MANDATE_SIGNED");
  await rm.fill("#sm-note", "Engagement letter countersigned");
  await rm.getByRole("button", { name: "Update stage" }).click();
  const history = rm.getByTestId("stage-history");
  await expect(history).toContainText("Engagement letter countersigned");
  await expect(rm.getByTestId("stepper").locator("[data-current]")).toContainText("2");

  // Stages from other pipelines are refused; hold/drop need a reason.
  expect((await rm.request.post(`/api/mandates/${id}/stage`, { data: { toStage: "DRHP_FILED" } })).status()).toBe(400);
  expect((await rm.request.post(`/api/mandates/${id}/stage`, { data: { toStage: "ON_HOLD" } })).status()).toBe(400);
  expect((await rm.request.post(`/api/mandates/${id}/stage`, { data: { toStage: "ON_HOLD", note: "Client busy with results" } })).status()).toBe(200);
  await rm.reload();
  await expect(rm.getByText("last active stage: Mandate signed")).toBeVisible();
  // Resume goes back to the last active stage.
  await expect(rm.locator("#sm-to")).toHaveValue("MANDATE_SIGNED");
  await rm.getByRole("button", { name: "Update stage" }).click();
  await expect(rm.getByTestId("stage-history").locator("li").first()).toContainText("On hold");
  await expect(rm.getByTestId("stage-history").locator("li").first()).toContainText("Mandate signed");

  // Service is locked once past Proposal.
  expect((await rm.request.patch(`/api/mandates/${id}`, { data: { service: "PRE_IPO" } })).status()).toBe(400);
});

test("board and list views with status tabs and service filter", async ({ browser }) => {
  const admin = await as(browser, "admin");
  await admin.goto("/mandates");
  const board = admin.getByTestId("board");
  await expect(board.getByTestId("column-drhp")).toContainText("Kaveri Agro Foods Ltd");
  await expect(board.getByTestId("column-raise")).toContainText("Sahyadri Renewables Pvt Ltd");
  await expect(board).not.toContainText("Nilgiri Foods Ltd"); // listed → not active

  await admin.getByRole("group", { name: "Mandate status" }).getByRole("link", { name: "Won" }).click();
  await expect(admin).toHaveURL(/status=won/);
  await expect(admin.getByTestId("board")).toContainText("Nilgiri Foods Ltd");

  await admin.goto("/mandates?view=list&status=all");
  await admin.getByLabel("Services").selectOption("VALUATION_RESTRUCTURING");
  await expect(admin).toHaveURL(/service=VALUATION_RESTRUCTURING/);
  const rows = admin.getByTestId("mandate-table").locator("tr");
  await expect(rows).toHaveCount(2);
  await expect(admin.getByTestId("mandate-table")).toContainText("Reddy Pharma Formulations Pvt Ltd");
});

test("access: RMs see their own mandates only; compliance and viewers are read-only", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const kaveri = (await mandates(admin)).find((m) => m.client.name === "Kaveri Agro Foods Ltd")!;
  const rm1 = await as(browser, "rm1");
  expect((await mandates(rm1)).every((m) => m.client.name !== "Kaveri Agro Foods Ltd")).toBe(true);
  expect((await rm1.request.get(`/api/mandates/${kaveri.id}`)).status()).toBe(404);

  for (const who of ["compliance", "viewer"] as const) {
    const page = await as(browser, who);
    await page.goto(`/mandates/${kaveri.id}`);
    await expect(page.getByRole("heading", { name: kaveri.title })).toBeVisible();
    await expect(page.getByTestId("stage-mover")).toHaveCount(0);
    expect((await page.request.post(`/api/mandates/${kaveri.id}/stage`, { data: { toStage: "DRHP_FILED" } })).status()).toBe(403);
  }
});

test("IPO mandates link to their issue record; an issue can back only one mandate", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const all = await mandates(admin);
  const kaveri = all.find((m) => m.client.name === "Kaveri Agro Foods Ltd")!;
  const ipos = (await (await admin.request.get("/api/ipos")).json()).ipos as { id: string; companyName: string }[];
  const sahyadriIssue = ipos.find((i) => i.companyName === "Sahyadri Renewables Ltd")!;
  const tracker = ipos.find((i) => i.companyName === "Kaveri Fintech Ltd")!;

  expect((await admin.request.patch(`/api/mandates/${kaveri.id}`, { data: { ipoId: sahyadriIssue.id } })).status()).toBe(409);

  await admin.goto(`/mandates/${kaveri.id}`);
  await admin.getByLabel("IPO issue").selectOption(tracker.id);
  await admin.getByRole("button", { name: "Save", exact: true }).click();
  await expect(admin.getByRole("link", { name: "Kaveri Fintech Ltd" })).toBeVisible();

  await admin.goto(`/ipos/${tracker.id}`);
  await expect(admin.getByTestId("mandate-list")).toContainText("Kaveri Agro Foods Ltd");

  // Unlink again so other specs see the seeded state.
  expect((await admin.request.patch(`/api/mandates/${kaveri.id}`, { data: { ipoId: "" } })).status()).toBe(200);
});

test("stage moves notify the lead advisor", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const patel = (await mandates(admin)).find((m) => m.client.name === "Patel Precision Engineering Pvt Ltd" && m.stage === "TERM_SHEET")!;
  expect((await admin.request.post(`/api/mandates/${patel.id}/stage`, { data: { toStage: "DOCUMENTATION", note: "SHA drafting started" } })).status()).toBe(200);
  const rm = await as(browser, "rm1");
  const notes = (await (await rm.request.get("/api/notifications")).json()).notifications as { title: string; body: string }[];
  expect(notes[0].title).toMatch(/→ Documentation$/);
  expect(notes[0].body).toContain("SHA drafting started");
});
