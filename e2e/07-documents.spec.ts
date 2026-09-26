import { expect, test, type Page } from "@playwright/test";
import { as } from "./helpers";

const pdf = (name: string, body = name) => ({ name, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4\n% ${body}\n%%EOF\n`) });

async function clientId(page: Page, q: string) {
  return ((await (await page.request.get(`/api/clients?q=${encodeURIComponent(q)}`)).json()).clients[0] as { id: string }).id;
}

test("upload a categorised document, then a new version; old version stays downloadable", async ({ browser }) => {
  const rm = await as(browser, "rm2");
  const id = await clientId(rm, "Arjun Kapoor");
  await rm.goto(`/clients/${id}`);

  await rm.getByRole("button", { name: "Upload", exact: true }).click();
  await rm.selectOption("#du-category", "RISK_DISCLOSURE");
  await rm.fill("#du-title", "RDD – Arjun");
  await rm.setInputFiles("#du-file", pdf("rdd-v1.pdf", "first"));
  await rm.getByRole("dialog").getByRole("button", { name: "Upload" }).click();
  const row = rm.getByTestId("document-row").filter({ hasText: "RDD – Arjun" });
  await expect(row).toContainText("Risk Disclosure Document");
  await expect(row).toContainText("v1");
  await expect(row).toContainText("Priya Nair");

  await row.getByRole("button", { name: "New version" }).click();
  await rm.setInputFiles("#du-file", pdf("rdd-v2.pdf", "second"));
  await rm.getByRole("dialog").getByRole("button", { name: "Upload" }).click();
  await expect(row).toContainText("v2");
  await expect(row).toContainText("rdd-v2.pdf");
  await expect(row).toContainText("(2 versions)");

  await row.getByRole("button", { name: "Show versions" }).click();
  const old = rm.getByTestId("document-version").filter({ hasText: "rdd-v1.pdf" });
  await expect(old).toContainText("v1");

  // Both versions exist and v1 still downloads with its original content.
  const docs = (await (await rm.request.get(`/api/clients/${id}/documents`)).json()).documents as { id: string; fileName: string; version: number; isLatest: boolean }[];
  const v1 = docs.find((d) => d.fileName === "rdd-v1.pdf")!;
  const v2 = docs.find((d) => d.fileName === "rdd-v2.pdf")!;
  expect([v1.isLatest, v2.isLatest, v2.version]).toEqual([false, true, 2]);
  const body = await (await rm.request.get(`/api/documents/${v1.id}`)).text();
  expect(body).toContain("first");
});

test("filter documents by category; seeded version history visible", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const id = await clientId(admin, "Suresh Patel");
  await admin.goto(`/clients/${id}`);
  const rows = admin.getByTestId("document-row");
  await expect(rows.filter({ hasText: "Contract note – Sep 2026" })).toContainText("v2");
  await admin.getByLabel("Filter documents by category").selectOption("CONTRACT_NOTE");
  await expect(rows).toHaveCount(1);
  await admin.getByLabel("Filter documents by category").selectOption("KYC_PAN");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("PAN Card");
});

test("permissions: compliance and viewer cannot upload; other RMs cannot see", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const id = await clientId(admin, "Suresh Patel");
  for (const who of ["compliance", "viewer"] as const) {
    const page = await as(browser, who);
    const res = await page.request.post(`/api/clients/${id}/documents`, { multipart: { category: "OTHER", file: pdf("x.pdf") } });
    expect(res.status()).toBe(403);
    await page.goto(`/clients/${id}`);
    await expect(page.getByRole("button", { name: "Upload", exact: true })).toHaveCount(0);
  }
  const rm2 = await as(browser, "rm2");
  expect((await rm2.request.get(`/api/clients/${id}/documents`)).status()).toBe(404);
});
