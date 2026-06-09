import { expect, test } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD, hasCreds, SKIP_MESSAGE } from "./support/helpers";

test.describe("autenticação", () => {
  test.skip(!hasCreds, SKIP_MESSAGE);

  test("login com senha inválida mostra erro e mantém o usuário no /login", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByPlaceholder("seu@construtora.com.br").fill(E2E_EMAIL);
    await page.getByPlaceholder("Sua senha").fill("senha-invalida-e2e-000");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("login válido redireciona para /inicio", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("seu@construtora.com.br").fill(E2E_EMAIL);
    await page.getByPlaceholder("Sua senha").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    await expect(page).toHaveURL(/\/inicio$/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: /Boa (dia|tarde|noite),/ })
    ).toBeVisible();
    await expect(page.getByText("Painel da operação")).toBeVisible();
  });
});
