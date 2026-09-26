import { expect, test } from "@playwright/test";
import { as } from "./helpers";

function parse(csv: string) {
  return csv.replace(/^﻿/, "").trim().split("\r\n");
}

test("client KYC export: headers, filters and RM scoping", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const res = await admin.request.get("/api/reports/clients");
  expect(res.headers()["content-type"]).toContain("text/csv");
  expect(res.headers()["content-disposition"]).toMatch(/attachment; filename="clients-kyc-\d{4}-\d{2}-\d{2}\.csv"/);
  const lines = parse(await res.text());
  expect(lines[0]).toBe("Client,Phone,Email,PAN,Client type,Source,KYC status,KYC last changed,KYC changed by,Assigned RM,Client since");
  const total = (await (await admin.request.get("/api/clients")).json()).total;
  expect(lines.length - 1).toBe(total);

  const verified = parse(await (await admin.request.get("/api/reports/clients?kyc=VERIFIED")).text()).slice(1);
  expect(verified.length).toBeGreaterThan(0);
  expect(verified.every((l) => l.includes(",Verified,"))).toBe(true);

  const rm = await as(browser, "rm1");
  const mine = parse(await (await rm.request.get("/api/reports/clients")).text()).slice(1);
  expect(mine.every((l) => l.includes("Rohan Sharma"))).toBe(true);
  expect(mine.some((l) => l.includes("Priya Nair"))).toBe(false);
});

test("IPO summary, RM performance and lead source exports", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const ipo = parse(await (await admin.request.get("/api/reports/ipo-summary")).text());
  expect(ipo[0]).toContain("Clients applied,Lots applied,Total amount (INR)");
  const nilgiri = ipo.find((l) => l.startsWith("Nilgiri Foods Ltd"))!;
  expect(nilgiri).toContain(",Listed,");
  expect(nilgiri).toContain(",2,4,58752.00,"); // 2 clients, 4 lots, ₹58,752

  const perf = parse(await (await admin.request.get("/api/reports/rm-performance?range=quarter")).text());
  expect(perf[0]).toContain("Leads assigned,Leads converted,Conversion rate %");
  expect(perf.filter((l) => l.startsWith("Rohan Sharma") || l.startsWith("Priya Nair"))).toHaveLength(2);

  const rm = await as(browser, "rm2");
  const own = parse(await (await rm.request.get("/api/reports/rm-performance?range=quarter")).text());
  expect(own).toHaveLength(2);
  expect(own[1]).toMatch(/^Priya Nair,/);

  const viewer = await as(browser, "viewer");
  expect((await viewer.request.get("/api/reports/rm-performance")).status()).toBe(403);

  const sources = parse(await (await admin.request.get("/api/reports/lead-sources?range=quarter")).text());
  expect(sources.map((l) => l.split(",")[0])).toEqual(["Source", "Referral", "Website", "Call-in", "Other"]);
});

test("CSV cells are escaped and formula-injection safe", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const leadRes = await admin.request.post("/api/leads", { data: { name: '=HYPERLINK("x", "Evil, Inc")', phone: "+91 90000 00009", source: "OTHER" } });
  const { lead } = await leadRes.json();
  await admin.request.post(`/api/leads/${lead.id}/convert`, { data: {} });
  const csv = await (await admin.request.get("/api/reports/clients?q=HYPERLINK")).text();
  expect(csv).toContain(`"'=HYPERLINK(""x"", ""Evil, Inc"")"`);
});

test("reports page renders charts, tables and export links", async ({ browser }) => {
  const admin = await as(browser, "admin");
  await admin.goto("/reports");
  await expect(admin.getByTestId("export-link")).toHaveCount(4);
  await expect(admin.getByRole("img", { name: "IPO application value by month" })).toBeVisible();
  await expect(admin.getByRole("img", { name: "New leads and conversions by month" })).toBeVisible();
  await expect(admin.getByTestId("pipeline-table").locator("tr")).toHaveCount(6);
  await expect(admin.getByTestId("source-table").locator("tr")).toHaveCount(4);

  const viewer = await as(browser, "viewer");
  await viewer.goto("/reports");
  await expect(viewer.getByTestId("export-link")).toHaveCount(3); // no RM performance export
});
