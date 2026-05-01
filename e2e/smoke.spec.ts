import { expect, test } from "@playwright/test";

const protectedPaths = ["/inicio", "/obras", "/canal/geral"];

test("login page renders", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByText("obralia", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Entrar na sua conta" })).toBeVisible();
  await expect(page.getByPlaceholder("seu@construtora.com.br")).toBeVisible();
});

test("protected routes redirect anonymous users to login", async ({ page }) => {
  for (const path of protectedPaths) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page, `${path} should redirect to /login`).toHaveURL(
      /\/login$/
    );
  }
});

test("security headers are present", async ({ request }) => {
  const response = await request.get("/login");

  expect(response.ok()).toBeTruthy();
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin"
  );
  expect(response.headers()["permissions-policy"]).toContain("camera=()");
  expect(response.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'"
  );
  expect(response.headers()["x-powered-by"]).toBeUndefined();
});

test("invite API requires authentication", async ({ request }) => {
  const response = await request.post("/api/invites", {
    data: {
      email: "e2e@example.com",
      name: "E2E User",
      role: "viewer",
      organizationId: "00000000-0000-4000-8000-000000000000",
    },
  });

  expect(response.status()).toBe(401);
});

test("authenticated user can reach the app shell", async ({ page }) => {
  const email = process.env.E2E_AUTH_EMAIL;
  const password = process.env.E2E_AUTH_PASSWORD;

  if (!email || !password) {
    test.skip(true, "Set E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD.");
    return;
  }

  await page.goto("/login");
  await page.getByPlaceholder("seu@construtora.com.br").fill(email);
  await page.getByPlaceholder("Sua senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByText(/Bem-vindo ao/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Obras" })).toBeVisible();
});
