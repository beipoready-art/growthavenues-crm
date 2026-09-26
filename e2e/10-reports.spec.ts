import { expect, test } from "@playwright/test";
import { as } from "./helpers";

function parse(csv: string) {
  return csv.replace(/^﻿/, "").trim().split("\r\n");
}

test("client companies export: headers, filters and RM scoping", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const res = await admin.request.get("/api/reports/clients");
  expect(res.headers()["content-type"]).toContain("text/csv");
  expect(res.headers()["content-disposition"]).toMatch(/attachment; filename="client-companies-\d{4}-\d{2}-\d{2}\.csv"/);
  const lines = parse(await res.text());
  expect(lines[0]).toContain("Company,CIN,PAN,GSTIN,Entity type,Sector,City,Primary contact");
  expect(lines[0]).toContain("Revenue (INR Cr),EBITDA (INR Cr)");
  const total = (await (await admin.request.get("/api/clients")).json()).total;
  expect(lines.length - 1).toBe(total);
  expect(lines.find((l) => l.startsWith("Sahyadri Renewables Pvt Ltd"))).toContain("U40100MH2016PTC281234");

  const verified = parse(await (await admin.request.get("/api/reports/clients?kyc=VERIFIED")).text()).slice(1);
  expect(verified.length).toBeGreaterThan(0);
  expect(verified.every((l) => l.includes(",Verified,"))).toBe(true);

  const rm = await as(browser, "rm1");
  const mine = parse(await (await rm.request.get("/api/reports/clients")).text()).slice(1);
  expect(mine.every((l) => l.includes("Rohan Sharma"))).toBe(true);
});

test("mandate pipeline, RM performance and lead source exports", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const m = parse(await (await admin.request.get("/api/reports/mandates")).text());
  expect(m[0]).toContain("Code,Mandate,Client,Sector,Service,Board,Stage");
  const sahyadri = m.find((l) => l.includes("SME IPO on NSE Emerge") && l.includes("Sahyadri"))!;
  expect(sahyadri).toContain(",Issue open,");
  expect(sahyadri).toContain(",16200000,"); // ₹15L retainer + 3.5% of ₹42 Cr

  const rm2 = await as(browser, "rm2");
  const own = parse(await (await rm2.request.get("/api/reports/mandates")).text()).slice(1);
  expect(own.some((l) => l.includes("Sahyadri"))).toBe(false);
  expect(own.some((l) => l.includes("Kaveri Agro Foods Ltd"))).toBe(true);

  const perf = parse(await (await admin.request.get("/api/reports/rm-performance?range=quarter")).text());
  expect(perf[0]).toContain("Mandates signed,Mandates won,Fees won (INR),Live pipeline fee (INR)");
  expect(perf.filter((l) => l.startsWith("Rohan Sharma") || l.startsWith("Priya Nair"))).toHaveLength(2);
  const ownPerf = parse(await (await rm2.request.get("/api/reports/rm-performance?range=quarter")).text());
  expect(ownPerf).toHaveLength(2);
  expect(ownPerf[1]).toMatch(/^Priya Nair,/);

  const viewer = await as(browser, "viewer");
  expect((await viewer.request.get("/api/reports/rm-performance")).status()).toBe(403);

  const sources = parse(await (await admin.request.get("/api/reports/lead-sources?range=quarter")).text());
  expect(sources.map((l) => l.split(",")[0])).toEqual(["Source", "Website enquiry", "IPO readiness call", "IPO-ready check", "Referral", "Event / webinar", "Call-in", "Other"]);
});

test("CSV cells are escaped and formula-injection safe", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const leadRes = await admin.request.post("/api/leads", { data: { companyName: '=HYPERLINK("x", "Evil, Inc")', name: "Mallory", phone: "+91 90000 00009", source: "OTHER" } });
  const { lead } = await leadRes.json();
  await admin.request.post(`/api/leads/${lead.id}/convert`, { data: {} });
  const csv = await (await admin.request.get("/api/reports/clients?q=HYPERLINK")).text();
  expect(csv).toContain(`"'=HYPERLINK(""x"", ""Evil, Inc"")"`);
});

test("reports page renders charts, tables and export links", async ({ browser }) => {
  const admin = await as(browser, "admin");
  await admin.goto("/reports");
  await expect(admin.getByTestId("export-link")).toHaveCount(4);
  await expect(admin.getByRole("img", { name: "Fees of mandates signed by month" })).toBeVisible();
  await expect(admin.getByRole("img", { name: "New leads and conversions by month" })).toBeVisible();
  await expect(admin.getByTestId("pipeline-table").locator("tr")).toHaveCount(6);
  await expect(admin.getByTestId("source-table").locator("tr")).toHaveCount(7);

  const viewer = await as(browser, "viewer");
  await viewer.goto("/reports");
  await expect(viewer.getByTestId("export-link")).toHaveCount(3); // no RM performance export
});
