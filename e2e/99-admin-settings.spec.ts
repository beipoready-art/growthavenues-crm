import { expect, test } from "@playwright/test";
import { as } from "./helpers";

// 1×1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("admin updates the company profile and logo; header, sidebar and login reflect it", async ({ browser, page }) => {
  const admin = await as(browser, "admin");
  await admin.goto("/settings");
  await admin.fill("#cp-name", "Be IPO Ready Advisors");
  await admin.fill("#cp-phone", "+91 22 6000 7000");
  await admin.fill("#cp-email", "desk@beipoready.com");
  await admin.getByLabel("Logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await admin.getByRole("button", { name: "Save profile" }).click();
  await expect(admin.getByText("Saved.")).toBeVisible();

  await expect(admin.getByTestId("firm-name")).toHaveText("Be IPO Ready Advisors");
  const top = admin.getByTestId("topbar");
  await expect(top).toContainText("+91 22 6000 7000");
  await expect(top).toContainText("desk@beipoready.com");

  // Logo is public (login page) and served as the uploaded image.
  const logo = await page.request.get("/api/settings/logo");
  expect(logo.status()).toBe(200);
  expect(logo.headers()["content-type"]).toBe("image/png");
  await page.goto("/login");
  await expect(page.getByTestId("firm-name")).toHaveText("Be IPO Ready Advisors");

  // Validation: SVG logos and bad URLs are rejected; non-admins can't save.
  const form = { firmName: "X Co", website: "not-a-url" };
  expect((await admin.request.put("/api/settings/company", { multipart: form })).status()).toBe(400);
  const svg = await admin.request.put("/api/settings/company", { multipart: { firmName: "X Co", logo: { name: "x.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") } } });
  expect(svg.status()).toBe(400);
  const rm = await as(browser, "rm1");
  expect((await rm.request.put("/api/settings/company", { multipart: { firmName: "Hacked" } })).status()).toBe(403);
  await rm.goto("/settings");
  await expect(rm).toHaveURL("/forbidden");

  // Restore
  await admin.goto("/settings");
  await admin.fill("#cp-name", "Be IPO Ready");
  await admin.getByRole("button", { name: "Remove logo" }).click();
  await admin.getByRole("button", { name: "Save profile" }).click();
  await expect(admin.getByTestId("firm-name")).toHaveText("Be IPO Ready");
});

test("admin reassigns an RM's book; records, tasks and history move; new RM is notified", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const rohanClients = (await (await (await as(browser, "rm1")).request.get("/api/clients")).json()).total as number;
  await admin.goto("/users");
  const row = admin.getByRole("row", { name: /Rohan Sharma/ });
  await expect(row).toContainText("clients");
  await row.getByRole("button", { name: "Reassign book" }).click();
  await admin.selectOption("#ra-to", { label: "Priya Nair" });
  await admin.getByRole("button", { name: "Reassign", exact: true }).click();
  await expect(admin.getByTestId("reassign-result")).toContainText(`${rohanClients} clients`);
  await admin.getByRole("button", { name: "Done" }).click();
  await expect(admin.getByRole("row", { name: /Rohan Sharma/ })).toContainText("0 leads · 0 clients");

  const rm1 = await as(browser, "rm1");
  expect((await (await rm1.request.get("/api/clients")).json()).total).toBe(0);
  const rm2 = await as(browser, "rm2");
  const suresh = (await (await rm2.request.get("/api/clients?q=Sahyadri")).json()).clients[0];
  expect(suresh.assignedRm.name).toBe("Priya Nair");
  // Originating lead moved too, so the new RM can open it; history shows the move.
  await rm2.goto(`/clients/${suresh.id}`);
  await rm2.getByRole("link", { name: /View lead/ }).click();
  await expect(rm2).toHaveURL(/\/leads\//);
  await expect(rm2.getByRole("heading", { name: "Sahyadri Renewables Pvt Ltd" })).toBeVisible();
  await expect(rm2.getByText("changed assigned RM Rohan Sharma → Priya Nair")).toBeVisible();
  // Interaction log survived the RM change.
  await rm2.goto(`/clients/${suresh.id}`);
  await expect(rm2.getByTestId("timeline")).toContainText("logged by Rohan Sharma");
  // Open tasks moved and the new RM was notified.
  await rm2.goto("/tasks");
  await expect(rm2.getByText("Share day-2 subscription status with Sahyadri promoter")).toBeVisible();
  const notes = (await (await rm2.request.get("/api/notifications")).json()).notifications as { title: string }[];
  expect(notes.some((n) => /reassigned to you/.test(n.title))).toBe(true);

  // Guard rails: no self-reassign; only admins can reassign. (Re-seed to restore the original books.)
  const users = (await (await admin.request.get("/api/users")).json()).users as { id: string; email: string }[];
  const rohan = users.find((u) => u.email === "rohan@beipoready.com")!;
  const priya = users.find((u) => u.email === "priya@beipoready.com")!;
  expect((await admin.request.post("/api/admin/reassign", { data: { fromRmId: rohan.id, toRmId: rohan.id } })).status()).toBe(400);
  expect((await rm2.request.post("/api/admin/reassign", { data: { fromRmId: priya.id, toRmId: rohan.id } })).status()).toBe(403);
});

test("admin can add and deactivate RM / compliance accounts", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const email = `rm-${Date.now()}@beipoready.com`;
  const res = await admin.request.post("/api/users", { data: { name: "New RM", email, password: "Password@123", role: "RM" } });
  expect(res.status()).toBe(201);
  const { user } = await res.json();
  expect((await admin.request.patch(`/api/users/${user.id}`, { data: { active: false } })).status()).toBe(200);
  await admin.goto("/users");
  await expect(admin.getByRole("row", { name: new RegExp(email) })).toContainText("Inactive");
});
