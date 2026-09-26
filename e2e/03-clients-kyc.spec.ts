import { expect, test, type Page } from "@playwright/test";
import { as } from "./helpers";

const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4\n% ${name}\n%%EOF\n`) });
const KYC = ["KYC_COI", "KYC_PAN", "KYC_GST", "KYC_MOA_AOA", "KYC_BOARD_RESOLUTION", "KYC_PROMOTER_KYC"];

async function idOf(page: Page, api: "leads" | "clients", q: string) {
  const data = await (await page.request.get(`/api/${api}?q=${encodeURIComponent(q)}`)).json();
  return data[api][0].id as string;
}

async function uploadKyc(page: Page, category: string, fileName: string) {
  const row = page.getByTestId(`kyc-doc-${category}`);
  await row.locator("input[type=file]").setInputFiles(pdf(fileName));
  await expect(row.getByText(fileName)).toBeVisible();
}

test("full flow: onboard enquiry as client → contacts → company KYC → compliance verifies", async ({ browser }) => {
  const rm = await as(browser, "rm1");
  const leadId = await idOf(rm, "leads", "Vardhaman");

  // Onboard
  await rm.goto(`/leads/${leadId}`);
  await rm.getByRole("button", { name: "Onboard as client" }).click();
  await rm.fill("#cv-cin", "U25200GJ2012PTC070707");
  await rm.fill("#cv-pan", "AABCV1234K");
  await rm.getByRole("button", { name: "Convert", exact: true }).click();
  await expect(rm).toHaveURL(/\/clients\/[a-z0-9]+$/);
  await expect(rm.getByRole("heading", { name: "Vardhaman Polymers Pvt Ltd" })).toBeVisible();
  const clientUrl = rm.url();
  const clientId = clientUrl.split("/").pop()!;
  // The enquiry's contact becomes the primary contact.
  await expect(rm.getByTestId("contacts")).toContainText("Ankit Verma");
  await expect(rm.getByTestId("contacts")).toContainText("Primary");

  // Enquiry is kept, marked converted.
  await rm.goto(`/leads/${leadId}`);
  await expect(rm.getByText("This lead was converted")).toBeVisible();
  expect((await rm.request.post(`/api/leads/${leadId}/convert`, { data: {} })).status()).toBe(409);

  // Add a CFO contact.
  await rm.goto(clientUrl);
  await rm.getByRole("button", { name: "+ Add contact" }).click();
  await rm.fill("#ct-name", "Nisha Shah");
  await rm.fill("#ct-designation", "CFO");
  await rm.fill("#ct-email", "nisha@vardhamanpolymers.in");
  await rm.getByRole("button", { name: "Save" }).click();
  await expect(rm.getByTestId("contacts")).toContainText("Nisha Shah");

  // Submitting without documents is refused.
  const early = await rm.request.post(`/api/clients/${clientId}/kyc`, { data: { toStatus: "SUBMITTED" } });
  expect(early.status()).toBe(400);
  expect((await early.json()).error).toMatch(/Upload all 6 onboarding documents/);

  // Upload the six company documents, replacing one to create a version.
  await uploadKyc(rm, "KYC_PAN", "pan-v1.pdf");
  await uploadKyc(rm, "KYC_PAN", "pan-v2.pdf");
  await expect(rm.getByTestId("kyc-doc-KYC_PAN").getByText("1 previous version(s)")).toBeVisible();
  for (const c of KYC.filter((c) => c !== "KYC_PAN")) await uploadKyc(rm, c, `${c.toLowerCase()}.pdf`);

  await rm.getByRole("button", { name: "Submit for review" }).click();
  await rm.getByRole("button", { name: "Confirm" }).click();
  await expect(rm.getByTestId("kyc-audit").getByText("Rohan Sharma").first()).toBeVisible();
  await expect(rm.getByRole("button", { name: "Replace" })).toHaveCount(0); // documents locked
  expect((await rm.request.post(`/api/clients/${clientId}/kyc`, { data: { toStatus: "UNDER_REVIEW" } })).status()).toBe(403);
  const docs = (await (await rm.request.get(`/api/clients/${clientId}/documents`)).json()).documents;

  // Compliance reviews and verifies.
  const co = await as(browser, "compliance");
  await co.goto("/kyc");
  await co.getByRole("link", { name: "Vardhaman Polymers Pvt Ltd" }).click();
  await co.getByRole("button", { name: "Start review" }).click();
  await co.getByRole("button", { name: "Confirm" }).click();
  await co.getByRole("button", { name: "Verify" }).click();
  await co.fill("#kyc-note", "Incorporation docs verified with MCA");
  await co.getByRole("button", { name: "Confirm" }).click();
  const audit = co.getByTestId("kyc-audit");
  await expect(audit.getByText("Incorporation docs verified with MCA")).toBeVisible();
  await expect(audit.locator("li")).toHaveCount(4);

  // Compliance can download but cannot edit the company.
  expect((await co.request.get(`/api/documents/${docs[0].id}`)).status()).toBe(200);
  expect((await co.request.patch(`/api/clients/${clientId}`, { data: { notes: "x" } })).status()).toBe(403);
  await expect(co.getByRole("button", { name: "Edit company" })).toHaveCount(0);

  // Another RM can neither see the client nor its documents.
  const rm2 = await as(browser, "rm2");
  expect((await rm2.request.get(`/api/clients/${clientId}`)).status()).toBe(404);
  expect((await rm2.request.get(`/api/documents/${docs[0].id}`)).status()).toBe(404);
});

test("financials drive the indicative SME / mainboard screen; identifiers are validated", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const reddy = await idOf(admin, "clients", "Reddy Pharma");
  await admin.goto(`/clients/${reddy}`);
  await expect(admin.getByTestId("eligibility")).toContainText("Indicatively SME-platform eligible");

  await admin.getByRole("button", { name: "Edit company" }).click();
  await admin.fill("#cf-ebitda", "22");
  await admin.fill("#cf-nw", "80");
  await admin.getByRole("button", { name: "Save changes" }).click();
  await expect(admin.getByTestId("eligibility")).toContainText("Indicatively mainboard-eligible");

  const bad = await admin.request.patch(`/api/clients/${reddy}`, { data: { cin: "NOT-A-CIN" } });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error).toMatch(/CIN must look like/);
  expect((await admin.request.patch(`/api/clients/${reddy}`, { data: { gstin: "27AAAAA" } })).status()).toBe(400);
});

test("rejection requires a reason and allows resubmission", async ({ browser }) => {
  const co = await as(browser, "compliance");
  const clientId = await idOf(co, "clients", "Nimbus Tech"); // seeded as Under Review
  expect((await co.request.post(`/api/clients/${clientId}/kyc`, { data: { toStatus: "REJECTED" } })).status()).toBe(400);
  expect((await co.request.post(`/api/clients/${clientId}/kyc`, { data: { toStatus: "REJECTED", note: "Board resolution unsigned" } })).status()).toBe(200);

  const rm = await as(browser, "rm2");
  await rm.goto(`/clients/${clientId}`);
  await expect(rm.getByText("Board resolution unsigned")).toBeVisible();
  await expect(rm.getByRole("button", { name: "Replace" }).first()).toBeVisible();
  await rm.getByRole("button", { name: "Resubmit" }).click();
  await rm.getByRole("button", { name: "Confirm" }).click();
  await expect(rm.getByRole("button", { name: "Resubmit" })).toHaveCount(0);
});

test("clients filters, contact search and RM scoping", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const get = async (qs: string) => (await (await admin.request.get(`/api/clients?${qs}`)).json()).clients as { name: string }[];
  expect((await get("kyc=VERIFIED")).map((c) => c.name)).toContain("Sahyadri Renewables Pvt Ltd");
  expect((await get("type=PUBLIC_LIMITED")).map((c) => c.name).sort()).toEqual(["Kaveri Agro Foods Ltd", "Nilgiri Foods Ltd"]);
  expect((await get("q=AAGCN")).map((c) => c.name)).toEqual(["Nimbus Tech Pvt Ltd"]);
  expect((await get("q=Latha")).map((c) => c.name)).toEqual(["Kaveri Agro Foods Ltd"]); // matches a contact
  expect(await get("from=2000-01-01&to=2000-01-01")).toHaveLength(0);

  const rm = await as(browser, "rm1");
  const mine = (await (await rm.request.get("/api/clients")).json()).clients as { assignedRm: { name: string } }[];
  expect(mine.length).toBeGreaterThan(0);
  for (const c of mine) expect(c.assignedRm.name).toBe("Rohan Sharma");
});

test("uploads reject disallowed file types", async ({ browser }) => {
  const rm = await as(browser, "rm2");
  const clientId = await idOf(rm, "clients", "Reddy Pharma"); // KYC pending
  const res = await rm.request.post(`/api/clients/${clientId}/documents`, {
    multipart: { category: "KYC_PAN", file: { name: "x.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") } },
  });
  expect(res.status()).toBe(400);
});
