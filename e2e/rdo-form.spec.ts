import { expect, test } from "@playwright/test";
import { hasCreds, listObraCards, SKIP_MESSAGE } from "./support/helpers";

/**
 * IMPORTANTE: este spec só faz asserções de presença do formulário.
 * Nunca submete nada — o ambiente alvo pode ser produção.
 */
test.describe("formulário de novo RDO", () => {
  test.skip(!hasCreds, SKIP_MESSAGE);

  test("/obras/[id]/rdos/novo renderiza todos os cards do formulário", async ({
    page,
  }) => {
    const cards = await listObraCards(page);
    test.skip(cards.length === 0, "Nenhuma obra visível para o usuário de teste.");

    await page.goto(`${cards[0].href}/rdos/novo`);

    await expect(page.getByRole("heading", { name: "Novo RDO" })).toBeVisible();

    // Card "Dados gerais" com os inputs de horário.
    await expect(
      page.getByRole("heading", { name: "Dados gerais" })
    ).toBeVisible();
    await expect(page.locator('input[name="date"]')).toBeVisible();
    const workStart = page.locator('input[name="work_start"]');
    const workEnd = page.locator('input[name="work_end"]');
    await expect(workStart).toBeVisible();
    await expect(workEnd).toBeVisible();
    await expect(workStart).toHaveAttribute("type", "time");
    await expect(workEnd).toHaveAttribute("type", "time");
    await expect(
      page.locator('input[name="work_break_minutes"]')
    ).toBeVisible();

    // Demais cards do formulário (títulos têm emoji como prefixo).
    await expect(page.getByRole("heading", { name: /Clima/ })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Mão de obra ·/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Equipamentos ·/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Materiais ·/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Atividades ·/ })
    ).toBeVisible();

    // Garantia explícita: nada é submetido neste teste.
  });
});
