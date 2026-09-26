import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { as } from "./helpers";

// The key the server was started with (from .env unless set in the environment).
const KEY = process.env.WEBSITE_API_KEY ?? /WEBSITE_API_KEY="?([^"\n]*)"?/.exec(readFileSync(".env", "utf8"))?.[1] ?? "";

test("website readiness-call booking creates an assigned enquiry and notifies the RM", async ({ request, browser }) => {
  const res = await request.post("/api/public/leads", {
    headers: { "X-Api-Key": KEY },
    data: {
      type: "readiness_call",
      companyName: "Website Test Industries Pvt Ltd",
      name: "Ravi Kumar",
      designation: "Promoter",
      email: "ravi@websitetest.in",
      phone: "+91 91234 56789",
      service: "SME_IPO",
      revenueCr: 45,
      preferredTime: "Tomorrow 11 am",
      message: "Planning an SME IPO next year",
      utm: { source: "google", campaign: "sme-ipo" },
    },
  });
  expect(res.status()).toBe(201);
  const { leadId, deduplicated } = await res.json();
  expect(deduplicated).toBe(false);

  const admin = await as(browser, "admin");
  const lead = (await (await admin.request.get(`/api/leads/${leadId}`)).json()).lead;
  expect(lead.source).toBe("READINESS_CALL");
  expect(lead.assignedRm).not.toBeNull();
  expect(lead.notes).toContain("Preferred call time: Tomorrow 11 am");
  await admin.goto(`/leads/${leadId}`);
  await expect(admin.getByText("received this enquiry from the website")).toBeVisible();
  const notes = (await (await admin.request.get("/api/notifications")).json()).notifications as { title: string }[];
  expect(notes.some((n) => n.title === "New website enquiry: Website Test Industries Pvt Ltd")).toBe(true);

  // Same person again (the 2-minute check) → merged into the same enquiry with the score.
  const again = await request.post("/api/public/leads", {
    headers: { Authorization: `Bearer ${KEY}` },
    data: {
      type: "readiness_check",
      companyName: "Website Test Industries Pvt Ltd",
      name: "Ravi Kumar",
      email: "ravi@websitetest.in",
      phone: "+91 91234 56789",
      readiness: { score: 71, answers: { "Years in operation": "5–7 years", "Audited financials (3 years)": "Yes" } },
    },
  });
  expect(again.status()).toBe(200);
  expect((await again.json()).leadId).toBe(leadId);
  await admin.goto(`/leads/${leadId}`);
  await expect(admin.getByText("71 / 100")).toBeVisible();
  await expect(admin.getByTestId("readiness-answers")).toContainText("Years in operation");
});

test("rejects bad keys and invalid payloads; honeypot is silently ignored; CORS for the website origin", async ({ request, browser }) => {
  const body = { companyName: "X Co", name: "X Y", phone: "+91 90000 11111" };
  expect((await request.post("/api/public/leads", { data: body })).status()).toBe(401);
  expect((await request.post("/api/public/leads", { headers: { "X-Api-Key": "wrong" }, data: body })).status()).toBe(401);
  const bad = await request.post("/api/public/leads", { headers: { "X-Api-Key": KEY }, data: { name: "X" } });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error).toContain("companyName");

  const bot = await request.post("/api/public/leads", { headers: { "X-Api-Key": KEY }, data: { ...body, companyName: "Bot Spam Pvt Ltd", website: "http://spam" } });
  expect(bot.status()).toBe(202);
  const admin = await as(browser, "admin");
  expect((await (await admin.request.get("/api/leads?q=Bot Spam")).json()).leads).toHaveLength(0);

  const pre = await request.fetch("/api/public/leads", { method: "OPTIONS", headers: { Origin: "https://beipoready.com" } });
  expect(pre.status()).toBe(204);
  expect(pre.headers()["access-control-allow-origin"]).toBe("https://beipoready.com");
  const evil = await request.fetch("/api/public/leads", { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
  expect(evil.headers()["access-control-allow-origin"]).toBeUndefined();
});

test("settings show the integration details to admins", async ({ browser }) => {
  const admin = await as(browser, "admin");
  await admin.goto("/settings");
  await expect(admin.getByTestId("website-integration")).toContainText("/api/public/leads");
  await expect(admin.getByTestId("website-integration")).toContainText("Configured");
});
