import { expect, type Browser, type Page } from "@playwright/test";

export const PASSWORD = "Password@123";
export const USERS = {
  admin: "admin@beipoready.com",
  compliance: "compliance@beipoready.com",
  rm1: "rohan@beipoready.com", // Rohan Sharma
  rm2: "priya@beipoready.com", // Priya Nair
  viewer: "viewer@beipoready.com",
} as const;

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await expect(page).toHaveURL("/");
}

/** A fresh, signed-in page for one of the seeded users. */
export async function as(browser: Browser, who: keyof typeof USERS) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, USERS[who]);
  return page;
}

export async function json<T = Record<string, unknown>>(res: { json(): Promise<unknown> }) {
  return (await res.json()) as T;
}
