import { expect, test, type Page } from "@playwright/test";
import { as } from "./helpers";

async function idOf(page: Page, api: "leads" | "clients", q: string) {
  const data = await (await page.request.get(`/api/${api}?q=${encodeURIComponent(q)}`)).json();
  return data[api][0].id as string;
}

test("My tasks groups overdue / today / upcoming and the sidebar badge counts due tasks", async ({ browser }) => {
  const rm = await as(browser, "rm1");
  await rm.goto("/tasks");
  await expect(rm.getByTestId("tasks-overdue")).toContainText("Send KYC checklist to Ankit");
  await expect(rm.getByTestId("tasks-today")).toContainText("Remind Suresh");
  await expect(rm.getByTestId("tasks-upcoming")).toContainText("Follow up with Sneha");
  await expect(rm.getByTestId("badge-tasks")).toHaveText("2");

  // Completing the overdue task clears it and updates the badge.
  await rm.getByRole("button", { name: "Complete Send KYC checklist to Ankit" }).click();
  await expect(rm.getByTestId("tasks-overdue")).toContainText("Nothing overdue");
  await expect(rm.getByTestId("badge-tasks")).toHaveText("1");
  await rm.getByText(/Completed in the last 14 days/).click();
  await expect(rm.getByTestId("tasks-done")).toContainText("Send KYC checklist to Ankit");
});

test("RM adds a task from a client profile; it appears in My tasks", async ({ browser }) => {
  const rm = await as(browser, "rm2");
  const clientId = await idOf(rm, "clients", "Arjun Kapoor");
  await rm.goto(`/clients/${clientId}`);
  await rm.getByRole("button", { name: "+ Add task" }).click();
  await rm.fill("#tf-title", "Send Kaveri RHP summary");
  await rm.selectOption("#tf-priority", "HIGH");
  await expect(rm.locator("#tf-assignee")).toHaveCount(0); // RMs assign to themselves
  await rm.getByRole("button", { name: "Create task" }).click();
  await expect(rm.getByTestId("task-row").filter({ hasText: "Send Kaveri RHP summary" })).toContainText("High");

  await rm.goto("/tasks");
  await expect(rm.getByTestId("tasks-upcoming")).toContainText("Send Kaveri RHP summary");
  await expect(rm.getByTestId("tasks-upcoming")).toContainText("Client: Arjun Kapoor");
});

test("create from My tasks with a related record; edit and delete", async ({ browser }) => {
  const rm = await as(browser, "rm1");
  await rm.goto("/tasks");
  await rm.getByRole("button", { name: "+ Add task" }).click();
  await rm.fill("#tf-title", "Temp task to edit");
  await rm.selectOption("#tf-related", { label: "Sneha Kulkarni" });
  await rm.getByRole("button", { name: "Create task" }).click();
  const row = rm.getByTestId("task-row").filter({ hasText: "Temp task to edit" });
  await expect(row).toContainText("Lead: Sneha Kulkarni");

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
  const priyaClient = await idOf(admin, "clients", "Arjun Kapoor");
  const due = new Date(Date.now() + 86400000).toISOString();
  expect((await rm.request.post("/api/tasks", { data: { title: "Sneaky", clientId: priyaClient, dueAt: due } })).status()).toBe(404);

  const users = (await (await admin.request.get("/api/users")).json()).users as { id: string; email: string }[];
  const priya = users.find((u) => u.email === "priya@growthavenues.in")!;
  const rohan = users.find((u) => u.email === "rohan@growthavenues.in")!;
  const suresh = await idOf(admin, "clients", "Suresh Patel");
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
