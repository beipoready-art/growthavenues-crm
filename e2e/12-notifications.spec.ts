import { expect, test, type Page } from "@playwright/test";
import { as } from "./helpers";

type N = { id: string; type: string; title: string; readAt: string | null };
const list = async (page: Page) => (await (await page.request.get("/api/notifications?limit=100")).json()) as { notifications: N[]; unread: number };

test("generated reminders: task due/overdue and IPO closing soon, without duplicates", async ({ browser }) => {
  const rm = await as(browser, "rm1");
  await rm.goto("/"); // page load syncs reminders
  let { notifications } = await list(rm);
  expect(notifications.some((n) => n.type === "TASK_DUE" && n.title.startsWith("Overdue: Send KYC checklist"))).toBe(true);
  expect(notifications.some((n) => n.type === "TASK_DUE" && n.title.startsWith("Due today: Remind Suresh"))).toBe(true);
  const closing = notifications.find((n) => n.type === "IPO_CLOSING")!;
  expect(closing.title).toContain("Sahyadri Renewables Ltd closes");
  const before = notifications.length;
  await rm.goto("/leads");
  await rm.goto("/");
  ({ notifications } = await list(rm));
  expect(notifications.length).toBe(before);

  // Priya has no interested clients on the closing IPO → no IPO alert.
  const rm2 = await as(browser, "rm2");
  expect((await list(rm2)).notifications.some((n) => n.type === "IPO_CLOSING")).toBe(false);
});

test("KYC changes notify compliance on submit and the RM on review, never the actor", async ({ browser }) => {
  const rm = await as(browser, "rm2");
  const co = await as(browser, "compliance");
  const nimbus = (await (await co.request.get("/api/clients?q=Nimbus")).json()).clients[0]; // Under Review
  expect((await co.request.post(`/api/clients/${nimbus.id}/kyc`, { data: { toStatus: "REJECTED", note: "Board resolution missing" } })).status()).toBe(200);
  const rmNotes = (await list(rm)).notifications;
  expect(rmNotes[0].title).toBe("KYC rejected: Nimbus Tech Pvt Ltd");
  expect((await list(co)).notifications.some((n) => n.title === "KYC rejected: Nimbus Tech Pvt Ltd")).toBe(false);

  expect((await rm.request.post(`/api/clients/${nimbus.id}/kyc`, { data: { toStatus: "SUBMITTED" } })).status()).toBe(200);
  expect((await list(co)).notifications[0].title).toBe("KYC submitted: Nimbus Tech Pvt Ltd");
  expect((await list(rm)).notifications[0].title).not.toBe("KYC submitted: Nimbus Tech Pvt Ltd");
});

test("lead assignment notifies the new RM", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const farhan = (await (await admin.request.get("/api/leads?q=Farhan")).json()).leads[0];
  const users = (await (await admin.request.get("/api/users")).json()).users as { id: string; email: string }[];
  const priya = users.find((u) => u.email === "priya@growthavenues.in")!;
  await admin.request.patch(`/api/leads/${farhan.id}`, { data: { assignedRmId: priya.id } });
  const rm2 = await as(browser, "rm2");
  expect((await list(rm2)).notifications[0].title).toBe("Lead assigned to you: Farhan Qureshi");
});

test("notification center: bell badge, open marks read, mark unread, mark all read", async ({ browser }) => {
  const rm = await as(browser, "rm1");
  await rm.goto("/");
  const { unread } = await list(rm);
  await expect(rm.getByTestId("unread-badge")).toHaveText(String(unread));

  await rm.getByRole("button", { name: /Notifications/ }).click();
  const menu = rm.getByTestId("notification-menu");
  await menu.getByText(/Sahyadri Renewables Ltd closes/).click();
  await expect(rm).toHaveURL(/\/ipos\//);
  await expect(rm.getByTestId("unread-badge")).toHaveText(String(unread - 1));

  await rm.goto("/notifications");
  const row = rm.getByTestId("notification").filter({ hasText: "Sahyadri Renewables Ltd closes" });
  await expect(row).toHaveAttribute("data-read", "true");
  await row.getByRole("button", { name: "Mark unread" }).click();
  await expect(row).toHaveAttribute("data-read", "false");

  await rm.getByRole("link", { name: /Unread/ }).click();
  await expect(rm.getByTestId("notification")).toHaveCount(unread);
  await rm.getByRole("button", { name: "Mark all as read" }).click();
  await expect(rm.getByText("No unread notifications")).toBeVisible();
  await expect(rm.getByTestId("unread-badge")).toHaveCount(0);

  // Users can't touch other users' notifications.
  const rm2 = await as(browser, "rm2");
  const mine = (await list(rm)).notifications[0];
  expect((await rm2.request.patch(`/api/notifications/${mine.id}`, { data: { read: false } })).status()).toBe(404);
});

test("RM marks client interest on the IPO page; cron endpoint requires the secret", async ({ browser }) => {
  const rm = await as(browser, "rm2");
  const kaveri = (await (await rm.request.get("/api/ipos?q=Kaveri")).json()).ipos[0];
  await rm.goto(`/ipos/${kaveri.id}`);
  const row = rm.getByTestId("not-applied").locator("div").filter({ hasText: "Arjun Kapoor" }).first();
  await row.getByRole("button", { name: "Mark interested" }).click();
  await expect(row.getByRole("button", { name: "Interested" })).toBeVisible();

  const res = await rm.request.post("/api/cron/notifications");
  expect(res.status()).toBe(401);
});
