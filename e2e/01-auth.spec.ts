import { expect, test } from "@playwright/test";
import { as, login } from "./helpers";

test("unauthenticated users are redirected to login", async ({ page }) => {
  await page.goto("/leads");
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
});

test("inactive accounts cannot sign in", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", "neha@beipoready.com");
  await page.fill("#password", "Password@123");
  await page.click("button[type=submit]");
  await expect(page.getByText("awaiting activation")).toBeVisible();
});

test("only admins can manage users", async ({ browser }) => {
  const admin = await as(browser, "admin");
  await admin.goto("/users");
  await expect(admin.getByRole("heading", { name: "Users" })).toBeVisible();

  for (const who of ["rm1", "compliance", "viewer"] as const) {
    const page = await as(browser, who);
    await page.goto("/users");
    await expect(page).toHaveURL("/forbidden");
    expect((await page.request.get("/api/users")).status()).toBe(403);
  }
});

test("admin creates a user who can then sign in", async ({ browser, page }) => {
  const admin = await as(browser, "admin");
  await admin.goto("/users");
  const email = `e2e-${Date.now()}@beipoready.com`;
  await admin.getByRole("button", { name: "New user" }).click();
  await admin.fill("#cu-name", "E2E Compliance");
  await admin.fill("#cu-email", email);
  await admin.selectOption("#cu-role", "COMPLIANCE");
  await admin.fill("#cu-password", "Password@123");
  await admin.getByRole("button", { name: "Create user" }).click();
  await expect(admin.getByText(email)).toBeVisible();
  await login(page, email);
});

test("admins cannot deactivate themselves", async ({ browser }) => {
  const admin = await as(browser, "admin");
  const { users } = await (await admin.request.get("/api/users")).json();
  const me = users.find((u: { email: string }) => u.email === "admin@beipoready.com");
  const res = await admin.request.patch(`/api/users/${me.id}`, { data: { active: false } });
  expect(res.status()).toBe(400);
});
