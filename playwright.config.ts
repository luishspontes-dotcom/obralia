import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Base URL:
 * - E2E_BASE_URL        → testa um ambiente já no ar (deploy). Não sobe webServer local.
 * - PLAYWRIGHT_BASE_URL → compat com o fluxo antigo (webServer local).
 * - padrão              → http://127.0.0.1:3000 com `next start` gerenciado pelo Playwright.
 */
const externalBaseURL = process.env.E2E_BASE_URL;
const baseURL =
  externalBaseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

/** storageState compartilhado gravado pelo projeto "setup" (e2e/auth.setup.ts). */
export const STORAGE_STATE = path.join(
  __dirname,
  "test-results",
  ".auth",
  "user.json"
);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    timeout: 7_500,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    // Faz login 1x e salva o storageState pros projetos autenticados.
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // Testes anônimos ou que exercitam o próprio fluxo de login.
    {
      name: "chromium",
      testMatch: /(smoke|auth)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // Testes autenticados: reusam a sessão salva pelo setup.
    {
      name: "chromium-auth",
      testMatch: /(obras|rdo|rdo-form)\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
    },
  ],
  // Com E2E_BASE_URL apontando pra um deploy, não sobe servidor local.
  webServer: externalBaseURL
    ? undefined
    : {
        command: "npm run start -- -H 127.0.0.1 -p 3000",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_SUPABASE_URL:
            process.env.NEXT_PUBLIC_SUPABASE_URL ??
            "https://bhhscygbhaqyewejlgug.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY:
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
            "sb_publishable_tx3t7usTHlQo2tWazVeAwQ_ohUOOo_C",
          NEXT_PUBLIC_APP_URL: baseURL,
        },
      },
});
