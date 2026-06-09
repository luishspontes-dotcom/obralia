import { expect, type Page } from "@playwright/test";

/** Credenciais do usuário de teste (aceita os nomes novos e os legados). */
export const E2E_EMAIL =
  process.env.E2E_EMAIL ?? process.env.E2E_AUTH_EMAIL ?? "";
export const E2E_PASSWORD =
  process.env.E2E_PASSWORD ?? process.env.E2E_AUTH_PASSWORD ?? "";

export const hasCreds = Boolean(E2E_EMAIL && E2E_PASSWORD);

export const SKIP_MESSAGE =
  "Defina E2E_EMAIL e E2E_PASSWORD (e E2E_BASE_URL para testar um deploy) para rodar os testes autenticados. Veja e2e/README.md.";

export type ObraCard = {
  /** href relativo, ex.: /obras/<uuid> */
  href: string;
  /** quantidade de RDOs exibida no card (ícone "Relatórios") */
  reportCount: number;
};

/**
 * Abre /obras e devolve os cards de obra ordenados por quantidade de RDOs
 * (decrescente). Usa uma única navegação pra manter os testes rápidos.
 */
export async function listObraCards(page: Page): Promise<ObraCard[]> {
  await page.goto("/obras");
  await expect(
    page.getByRole("heading", { name: /^Obras \(\d+\)$/ })
  ).toBeVisible();

  const cards = page.locator("a.diario-obra-card");
  const total = await cards.count();
  const result: ObraCard[] = [];

  for (let i = 0; i < total; i++) {
    const card = cards.nth(i);
    const href = await card.getAttribute("href");
    if (!href) continue;

    let reportCount = 0;
    const counter = card.locator('[title="Relatórios"]');
    if ((await counter.count()) > 0) {
      const text = (await counter.first().innerText()).replace(/\D/g, "");
      reportCount = Number.parseInt(text, 10) || 0;
    }
    result.push({ href, reportCount });
  }

  return result.sort((a, b) => b.reportCount - a.reportCount);
}

/**
 * Devolve os hrefs dos RDOs listados na primeira página de /obras/[id]/rdos
 * (links da coluna "Data" da tabela).
 */
export async function listRdoHrefs(
  page: Page,
  obraHref: string
): Promise<string[]> {
  await page.goto(`${obraHref}/rdos`);
  await expect(
    page.getByRole("heading", { name: /^Relatórios \(\d+\)$/ })
  ).toBeVisible();

  const dateLinks = page.locator(".do-table tbody td:first-child a");
  const total = await dateLinks.count();
  const hrefs: string[] = [];
  for (let i = 0; i < total; i++) {
    const href = await dateLinks.nth(i).getAttribute("href");
    if (href) hrefs.push(href);
  }
  return hrefs;
}
