import { expect, test, type Page } from "@playwright/test";
import { as } from "./helpers";

async function idOf(page: Page, api: "leads" | "clients", q: string) {
  const data = await (await page.request.get(`/api/${api}?q=${encodeURIComponent(q)}`)).json();
  return data[api][0].id as string;
}

test("My tasks groups overdue / today / upcoming and the sidebar badge counts due tasks", async ({ browser }) => {
  const rm = await as(browser, "rm1");
  await rm.goto("/tasks");
  await expect(rm.getByTestId("tasks-overdue")).toContainText("Send IPO readiness checklist to Vardhaman");
  await expect(rm.getByTestId("tasks-today")).toContainText("Share day-2 subscription status");
  await expect(rm.getByTestId("tasks-upcoming")).toContainText("Discovery call follow-up: Kulkarni Agritech");
  await expect(rm.getByTestId("badge-tasks")).toHaveText("2");

  // Completing the overdue task clears it and updates the badge.
  await rm.getByRole("button", { name: "Complete Send IPO readiness checklist to Vardhaman" }).click();
  await expect(rm.getByTestId("tasks-overdue")).toContainText("Nothing overdue");
  await expect(rm.getByTestId("badge-tasks")).toHaveText("1");
  await rm.getByText(/Completed in the last 14 days/).click();
  await expect(rm.getByTestId("tasks-done")).toContainText("Send IPO readiness checklist to Vardhaman");
});

test("RM adds a task from a client profile; it appears in My tasks", async ({ browser }) => {
  const rm = await as(browser, "rm2");
  const clientId = await idOf(rm, "clients", "Kaveri Agro");
  await rm.goto(`/clients/${clientId}`);
  await rm.getByRole("button", { name: "+ Add task" }).click();
  await rm.fill("#tf-title", "Send DRHP comments tracker");
  await rm.selectOption("#tf-priority", "HIGH");
  await expect(rm.locator("#tf-assignee")).toHaveCount(0); // RMs assign to themselves
  await rm.getByRole("button", { name: "Create task" }).click();
  await expect(rm.getByTestId("task-row").filter({ hasText: "Send DRHP comments tracker" })).toContainText("High");

  await rm.goto("/tasks");
  await expect(rm.getByTestId("tasks-upcoming")).toContainText("Send DRHP comments tracker");
  await expect(rm.getByTestId("tasks-upcoming")).toContainText("Client: Kaveri Agro Foods Ltd");
});

test("create from My tasks with a related record; edit and delete", async ({ browser }) => {
  const rm = await as(browser, "rm1");
  await rm.goto("/tasks");
  await rm.getByRole("button", { name: "+ Add task" }).click();
  await rm.fill("#tf-title", "Temp task to edit");
  await rm.selectOption("#tf-related", { label: "Kulkarni Agritech Pvt Ltd" });
  await rm.getByRole("button", { name: "Create task" }).click();
  const row = rm.getByTestId("task-row").filter({ hasText: "Temp task to edit" });
  await expect(row).toContainText("Lead: Kulkarni Agritech Pvt Ltd");

  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await rm.fill("#tf-title", "Temp task edited");
  await rm.getByRole("button", { name: "Save" }).click();
  const edited = rm.getByTestId("task-row").filter({ hasText: "Temp task edited" });
  await expect(edited).toBeVisible();

  rm.once("dialog", (d) => d.accept());
  await edited.getByRole("button", { name: "Edit", exact: true }).click();
  await rm.getByRole("button", { name: "Delete" }).click();
  await expect(rm.getByTestId("task-row").filter({ hasText: "Temp task edited" })).toHaveCount(0);
});

test("access rules: RMs can't task others' records or assign others; admin can assign", async ({ browser }) => {
  const rm = await as(browser, "rm1");
  const admin = await as(browser, "admin");
  const priyaClient = await idOf(admin, "clients", "Kaveri Agro");
  const due = new Date(Date.now() + 86400000).toISOString();
  expect((await rm.request.post("/api/tasks", { data: { title: "Sneaky", clientId: priyaClient, dueAt: due } })).status()).toBe(404);

  const users = (await (await admin.request.get("/api/users")).json()).users as { id: string; email: string }[];
  const priya = users.find((u) => u.email === "priya@beipoready.com")!;
  const rohan = users.find((u) => u.email === "rohan@beipoready.com")!;
  const suresh = await idOf(admin, "clients", "Sahyadri");
  expect((await rm.request.post("/api/tasks", { data: { title: "Assign to Priya", clientId: suresh, dueAt: due, assignedToId: priya.id } })).status()).toBe(403);
  // Admin can't assign a task on Rohan's client to Priya (she can't see it), but can to Rohan.
  expect((await admin.request.post("/api/tasks", { data: { title: "Wrong RM", clientId: suresh, dueAt: due, assignedToId: priya.id } })).status()).toBe(400);
  const ok = await admin.request.post("/api/tasks", { data: { title: "Admin-assigned follow-up", clientId: suresh, dueAt: due, assignedToId: rohan.id } });
  expect(ok.status()).toBe(201);
  // Missing link is rejected.
  expect((await admin.request.post("/api/tasks", { data: { title: "Floating", dueAt: due } })).status()).toBe(400);

  const viewer = await as(browser, "viewer");
  expect((await viewer.request.post("/api/tasks", { data: { title: "x", clientId: suresh, dueAt: due } })).status()).toBe(403);
  await viewer.goto("/tasks");
  await expect(viewer).toHaveURL("/forbidden");
});
