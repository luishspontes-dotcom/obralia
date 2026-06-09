import { expect, test } from "@playwright/test";
import {
  hasCreds,
  listObraCards,
  listRdoHrefs,
  SKIP_MESSAGE,
} from "./support/helpers";

test.describe("RDOs", () => {
  test.skip(!hasCreds, SKIP_MESSAGE);

  test("lista de RDOs mostra paginação quando há mais de 50", async ({
    page,
  }) => {
    const cards = await listObraCards(page);
    const alvo = cards.find((c) => c.reportCount > 50);
    test.skip(
      !alvo,
      "Nenhuma obra com mais de 50 RDOs — paginação não exercitável neste ambiente."
    );

    await page.goto(`${alvo!.href}/rdos`);

    await expect(
      page.getByRole("heading", { name: /^Relatórios \(\d+\)$/ })
    ).toBeVisible();

    // A primeira página exibe no máximo 50 linhas.
    const rows = page.locator(".do-table tbody tr");
    expect(await rows.count()).toBeLessThanOrEqual(50);

    // Controles de paginação (rodapé da lista).
    await expect(page.getByText(/Página 1 de \d+/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Próximos/ })).toBeVisible();
  });

  test("detalhe de um RDO mostra clima, mão de obra e atividades", async ({
    page,
  }) => {
    const cards = await listObraCards(page);
    const alvo = cards.find((c) => c.reportCount > 0);
    test.skip(!alvo, "Nenhuma obra com RDOs neste ambiente.");

    const rdoHrefs = await listRdoHrefs(page, alvo!.href);
    test.skip(rdoHrefs.length === 0, "Lista de RDOs vazia neste ambiente.");

    // Mão de obra/atividades só aparecem quando preenchidos: tenta os
    // primeiros RDOs até encontrar um completo (dados de produção estáveis).
    let encontrouCompleto = false;
    const tentativas = Math.min(rdoHrefs.length, 3);

    for (let i = 0; i < tentativas; i++) {
      await page.goto(rdoHrefs[i]);

      // Header do RDO — sempre presente.
      await expect(
        page.getByRole("heading", { name: /^RDO #\d+/ })
      ).toBeVisible();

      // Clima e materiais são renderizados sempre.
      await expect(page.getByText(/Clima · Manhã/)).toBeVisible();
      await expect(page.getByText(/Clima · Tarde/)).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /Materiais ·/ })
      ).toBeVisible();

      const temMaoDeObra =
        (await page
          .getByRole("heading", { name: /Mão de obra · \d+ pessoas/ })
          .count()) > 0;
      const temAtividades =
        (await page.getByRole("heading", { name: /Atividades · \d+/ }).count()) >
        0;

      if (temMaoDeObra && temAtividades) {
        encontrouCompleto = true;
        break;
      }
    }

    expect(
      encontrouCompleto,
      `Nenhum dos ${tentativas} RDOs mais recentes tem mão de obra E atividades preenchidas.`
    ).toBe(true);
  });

  test("página de impressão do RDO renderiza", async ({ page }) => {
    const cards = await listObraCards(page);
    const alvo = cards.find((c) => c.reportCount > 0);
    test.skip(!alvo, "Nenhuma obra com RDOs neste ambiente.");

    const rdoHrefs = await listRdoHrefs(page, alvo!.href);
    test.skip(rdoHrefs.length === 0, "Lista de RDOs vazia neste ambiente.");

    await page.goto(`${rdoHrefs[0]}/imprimir`);

    // Cabeçalho do relatório impresso.
    await expect(page.getByText(/^RDO #\d+$/)).toBeVisible();
    await expect(page.getByText("obralia").first()).toBeVisible();

    // Metadados e seção de clima (sempre renderizada).
    await expect(page.getByText("Obra", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Clima", { exact: true })).toBeVisible();
    await expect(page.getByText("Manhã", { exact: true })).toBeVisible();
    await expect(page.getByText("Tarde", { exact: true })).toBeVisible();
  });
});
