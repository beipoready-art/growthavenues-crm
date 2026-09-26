import { expect, test, type Page } from "@playwright/test";
import { as } from "./helpers";

const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4\n% ${name}\n%%EOF\n`) });

async function idOf(page: Page, api: "leads" | "clients", q: string) {
  const data = await (await page.request.get(`/api/${api}?q=${encodeURIComponent(q)}`)).json();
  return data[api][0].id as string;
}

async function uploadKyc(page: Page, category: string, fileName: string) {
  const row = page.getByTestId(`kyc-doc-${category}`);
  await row.locator("input[type=file]").setInputFiles(pdf(fileName));
  await expect(row.getByText(fileName)).toBeVisible();
}

test("full flow: convert lead → upload KYC → submit → compliance review → verify", async ({ browser }) => {
  const rm = await as(browser, "rm1");
  const leadId = await idOf(rm, "leads", "Ankit Verma");

  // Convert
  await rm.goto(`/leads/${leadId}`);
  await rm.getByRole("button", { name: "Convert to client" }).click();
  await rm.fill("#cv-pan", "AKVPV1234Q");
  await rm.getByRole("button", { name: "Convert", exact: true }).click();
  await expect(rm).toHaveURL(/\/clients\/[a-z0-9]+$/);
  await expect(rm.getByRole("heading", { name: "Ankit Verma" })).toBeVisible();
  const clientUrl = rm.url();
  const clientId = clientUrl.split("/").pop()!;

  // Lead is kept, marked converted, and links to the client.
  await rm.goto(`/leads/${leadId}`);
  await expect(rm.getByText("This lead was converted")).toBeVisible();
  await expect(rm.getByRole("button", { name: "Convert to client" })).toHaveCount(0);
  expect((await rm.request.post(`/api/leads/${leadId}/convert`, { data: {} })).status()).toBe(409);

  // Submitting without documents is refused.
  const early = await rm.request.post(`/api/clients/${clientId}/kyc`, { data: { toStatus: "SUBMITTED" } });
  expect(early.status()).toBe(400);
  expect((await early.json()).error).toMatch(/Upload all four/);

  // Upload all four documents, replacing one to create a version.
  await rm.goto(clientUrl);
  await uploadKyc(rm, "KYC_PAN", "pan-v1.pdf");
  await uploadKyc(rm, "KYC_PAN", "pan-v2.pdf");
  await expect(rm.getByTestId("kyc-doc-KYC_PAN").getByText("1 previous version(s)")).toBeVisible();
  await uploadKyc(rm, "KYC_AADHAAR", "aadhaar.pdf");
  await uploadKyc(rm, "KYC_BANK_PROOF", "cheque.pdf");
  await uploadKyc(rm, "KYC_PHOTO", "photo.pdf");

  // RM cannot review; RM submits.
  expect((await rm.request.post(`/api/clients/${clientId}/kyc`, { data: { toStatus: "UNDER_REVIEW" } })).status()).toBe(400);
  await rm.getByRole("button", { name: "Submit for review" }).click();
  await rm.getByRole("button", { name: "Confirm" }).click();
  await expect(rm.getByTestId("kyc-audit").getByText("Rohan Sharma").first()).toBeVisible();
  await expect(rm.getByRole("button", { name: "Start review" })).toHaveCount(0);
  await expect(rm.getByRole("button", { name: "Replace" })).toHaveCount(0); // documents locked
  const docs = (await (await rm.request.get(`/api/clients/${clientId}/documents`)).json()).documents;
  expect((await rm.request.post(`/api/clients/${clientId}/kyc`, { data: { toStatus: "UNDER_REVIEW" } })).status()).toBe(403);

  // Compliance reviews and verifies.
  const co = await as(browser, "compliance");
  await co.goto("/kyc");
  await co.getByRole("link", { name: "Ankit Verma" }).click();
  await co.getByRole("button", { name: "Start review" }).click();
  await co.getByRole("button", { name: "Confirm" }).click();
  await co.getByRole("button", { name: "Verify" }).click();
  await co.fill("#kyc-note", "Originals sighted");
  await co.getByRole("button", { name: "Confirm" }).click();
  const audit = co.getByTestId("kyc-audit");
  await expect(audit.getByText("Originals sighted")).toBeVisible();
  await expect(audit.locator("li")).toHaveCount(4); // created, submitted, under review, verified
  await expect(audit.getByText("Vikram Rao").first()).toBeVisible();

  // Compliance can download documents but cannot edit the client.
  const dl = await co.request.get(`/api/documents/${docs[0].id}`);
  expect(dl.status()).toBe(200);
  expect(dl.headers()["content-disposition"]).toContain("attachment");
  expect((await co.request.patch(`/api/clients/${clientId}`, { data: { notes: "x" } })).status()).toBe(403);
  await expect(co.getByRole("button", { name: "Edit client" })).toHaveCount(0);

  // Another RM can neither see the client nor download its documents.
  const rm2 = await as(browser, "rm2");
  expect((await rm2.request.get(`/api/clients/${clientId}`)).status()).toBe(404);
  expect((await rm2.request.get(`/api/documents/${docs[0].id}`)).status()).toBe(404);
});

test("rejection requires a reason and allows resubmission", async ({ browser }) => {
  const co = await as(browser, "compliance");
  const clientId = await idOf(co, "clients", "Nimbus Tech"); // seeded as Under Review
  const noReason = await co.request.post(`/api/clients/${clientId}/kyc`, { data: { toStatus: "REJECTED" } });
  expect(noReason.status()).toBe(400);
  expect((await co.request.post(`/api/clients/${clientId}/kyc`, { data: { toStatus: "REJECTED", note: "Bank proof illegible" } })).status()).toBe(200);

  const rm = await as(browser, "rm2");
  await rm.goto(`/clients/${clientId}`);
  await expect(rm.getByText("Bank proof illegible")).toBeVisible();
  await expect(rm.getByRole("button", { name: "Replace" }).first()).toBeVisible(); // docs unlocked again
  await rm.getByRole("button", { name: "Resubmit" }).click();
  await rm.getByRole("button", { name: "Confirm" }).click();
  await expect(rm.getByRole("button", { name: "Resubmit" })).toHaveCount(0);
});

test("clients filters and RM scoping", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const get = async (qs: string) => (await (await admin.request.get(`/api/clients?${qs}`)).json()).clients as { name: string; kycStatus: string; clientType: string }[];
  expect((await get("kyc=VERIFIED")).map((c) => c.name)).toContain("Suresh Patel");
  expect((await get("type=HUF")).map((c) => c.name)).toEqual(["Patel Family HUF"]);
  expect((await get("q=AADCN")).map((c) => c.name)).toEqual(["Nimbus Tech Pvt Ltd"]);
  expect(await get("from=2000-01-01&to=2000-01-01")).toHaveLength(0);

  const rm = await as(browser, "rm1");
  const mine = (await (await rm.request.get("/api/clients")).json()).clients as { assignedRm: { name: string } }[];
  expect(mine.length).toBeGreaterThan(0);
  for (const c of mine) expect(c.assignedRm.name).toBe("Rohan Sharma");
});

test("uploads reject disallowed file types", async ({ browser }) => {
  const rm = await as(browser, "rm2");
  const clientId = await idOf(rm, "clients", "Kavita Reddy"); // Pending
  const res = await rm.request.post(`/api/clients/${clientId}/documents`, {
    multipart: { category: "KYC_PAN", file: { name: "x.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") } },
  });
  expect(res.status()).toBe(400);
});
