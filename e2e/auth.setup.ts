import fs from "node:fs";
import path from "node:path";
import { expect, test as setup } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD, hasCreds, SKIP_MESSAGE } from "./support/helpers";

/** Mantém em sincronia com STORAGE_STATE no playwright.config.ts. */
const STORAGE_STATE = path.join(
  __dirname,
  "..",
  "test-results",
  ".auth",
  "user.json"
);

setup("autentica e salva o storageState compartilhado", async ({ page }) => {
  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });

  if (!hasCreds) {
    // Grava um estado vazio pra que os projetos dependentes consigam abrir o
    // contexto — os specs autenticados fazem test.skip() por conta própria.
    fs.writeFileSync(
      STORAGE_STATE,
      JSON.stringify({ cookies: [], origins: [] })
    );
    setup.skip(true, SKIP_MESSAGE);
    return;
  }

  await page.goto("/login");
  await page.getByPlaceholder("seu@construtora.com.br").fill(E2E_EMAIL);
  await page.getByPlaceholder("Sua senha").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(page).toHaveURL(/\/inicio$/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: /Boa (dia|tarde|noite),/ })
  ).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
