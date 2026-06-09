import { expect, test } from "@playwright/test";
import { hasCreds, listObraCards, SKIP_MESSAGE } from "./support/helpers";

test.describe("obras", () => {
  test.skip(!hasCreds, SKIP_MESSAGE);

  test("/obras lista cards de obra", async ({ page }) => {
    await page.goto("/obras");

    await expect(
      page.getByRole("heading", { name: /^Obras \(\d+\)$/ })
    ).toBeVisible();

    const cards = page.locator("a.diario-obra-card");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);

    // Cada card aponta pra uma obra e tem título.
    const firstHref = await cards.first().getAttribute("href");
    expect(firstHref).toMatch(/^\/obras\/.+/);
    await expect(
      cards.first().locator(".diario-obra-card__title")
    ).not.toBeEmpty();
  });

  test("abrir uma obra mostra header e sidebar", async ({ page }) => {
    const cards = await listObraCards(page);
    test.skip(cards.length === 0, "Nenhuma obra visível para o usuário de teste.");

    await page.goto(cards[0].href);

    // Header com o nome da obra.
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).not.toBeEmpty();

    // Sidebar de navegação da obra.
    const sidebar = page.getByRole("navigation", { name: /Navegação da obra/ });
    await expect(sidebar).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: /Visão geral/ })
    ).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: /Relatórios/ })
    ).toBeVisible();

    // Métricas principais do painel da obra.
    await expect(
      page.getByRole("heading", { name: "Relatórios recentes" })
    ).toBeVisible();
  });
});
