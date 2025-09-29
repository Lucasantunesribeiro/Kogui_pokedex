import { test, expect } from '@playwright/test';

test('Pokedx Layout Visual Regression', async ({ page }) => {
  await page.goto('/pokedex');

  await page.waitForLoadState('networkidle');

  await page.waitForSelector('app-header-banner');
  await page.waitForSelector('app-stats-strip');
  await page.waitForSelector('app-filter-chips');
  await page.waitForSelector('app-pokemon-card');

  await expect(page).toHaveScreenshot('pokedex-layout-full.png', {
    fullPage: true,
    threshold: 0.02
  });
});

test('Pokedx Layout Components', async ({ page }) => {
  await page.goto('/pokedex');

  await page.waitForLoadState('networkidle');

  const headerBanner = page.locator('app-header-banner');
  await expect(headerBanner).toBeVisible();
  await expect(headerBanner).toContainText('Pokédx Digital');

  const statsStrip = page.locator('app-stats-strip');
  await expect(statsStrip).toBeVisible();
  await expect(statsStrip).toContainText('6');
  await expect(statsStrip).toContainText('18');
  await expect(statsStrip).toContainText('9');

  const filterChips = page.locator('app-filter-chips');
  await expect(filterChips).toBeVisible();
  await expect(filterChips.locator('.chip').first()).toContainText('Todos');

  const pokemonCards = page.locator('app-pokemon-card');
  await expect(pokemonCards).toHaveCount(3);

  await expect(pokemonCards.first()).toContainText('#001');
  await expect(pokemonCards.first()).toContainText('Bulbasaur');
});