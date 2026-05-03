import { expect, test } from "@playwright/test";

const protectedPaths = [
  "/inicio",
  "/obras",
  "/caixa",
  "/configuracoes",
  "/configuracoes/auditoria",
  "/canal/geral",
];

test("login page renders", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByText("obralia", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Entre na sua conta" })).toBeVisible();
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

test("health endpoint returns structured status", async ({ request }) => {
  const response = await request.get("/api/health");
  expect([200, 503]).toContain(response.status());

  const body = await response.json();
  expect(typeof body.ok).toBe("boolean");
  expect(body.checks.app).toBe(true);
  expect(body).not.toHaveProperty("serviceRoleKey");
  expect(body).not.toHaveProperty("supabaseServiceRoleKey");
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
  await expect(page.getByRole("heading", { name: /Boa (noite|dia|tarde),/ })).toBeVisible();
  await expect(page.getByText("Painel da operação")).toBeVisible();
  await expect(page.getByRole("link", { name: /Obras\s+\d+/ })).toBeVisible();

  await page.goto("/configuracoes/auditoria");
  await expect(page).toHaveURL(/\/configuracoes\/auditoria$/);
  await expect(page.getByRole("heading", { name: "Auditoria operacional" })).toBeVisible();
  await expect(page.getByText(/^10\/10$/)).toBeVisible();
  await expect(page.getByText("prontidao auditavel")).toBeVisible();
});
