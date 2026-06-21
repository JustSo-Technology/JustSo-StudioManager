import { expect, test } from "@playwright/test";

test("serves the StudioManager app shell", async ({ request }) => {
  const response = await request.get("/");
  const body = await response.text();

  expect(response.status()).toBe(200);
  expect(body).toContain("<!DOCTYPE html>");
});

test("serves the demo public tenant data", async ({ request }) => {
  const response = await request.get("/api/public/tenant/demo-studio");
  const body = await response.json();

  expect(response.status()).toBe(200);
  expect(body.profile.publicSlug).toBe("demo-studio");
  expect(body.spaces.length).toBeGreaterThan(0);
});

test("keeps the session endpoint private", async ({ request }) => {
  const response = await request.get("/api/auth/user");

  expect(response.status()).toBe(401);
});
