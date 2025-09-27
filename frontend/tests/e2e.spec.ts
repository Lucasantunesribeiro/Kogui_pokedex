import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const ARTIFACTS_DIR = path.join(__dirname, 'artifacts');

async function ensureArtifactsDir() {
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
}

test.describe('Autenticação e coleções do usuário', () => {
  test('registro, login, persistência, favoritos e equipe', async ({ page }) => {
    await ensureArtifactsDir();


    const username = `trainer_${randomUUID().slice(0, 8)}`;
    const password = `Pwd!${randomUUID().slice(0, 10)}`;

    await page.goto('/login');

    // Cadastro
    await page.getByRole('tab', { name: 'Registrar' }).click();
    await page.getByLabel('Usuário').fill(username);
    await page.getByLabel('E-mail (opcional)').fill(`${username}@example.com`);
    await page.getByLabel('Senha', { exact: true }).fill(password);
    await page.getByLabel('Confirmar senha').fill(password);
    await page.getByRole('button', { name: 'Cadastrar' }).click();

    await expect(page.locator('.feedback[data-type="success"]')).toContainText('Cadastro realizado', {
      timeout: 10_000,
    });

    // Login
    await page.getByRole('tab', { name: 'Entrar' }).click();
    await page.getByLabel('Usuário').fill(username);
    await page.getByLabel('Senha', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await page.waitForURL('**/');
    await expect(page.getByText(`Olá, ${username}`)).toBeVisible({ timeout: 15_000 });

    const storedSession = await page.evaluate(() => localStorage.getItem('kogui.auth'));
    expect(storedSession, 'Sessão deve existir no localStorage').not.toBeNull();

    const parsedSession = JSON.parse(storedSession!);
    expect(parsedSession.access).toBeTruthy();
    expect(parsedSession.refresh).toBeTruthy();
    expect(parsedSession.user?.username).toBe(username);

    // Favoritar e adicionar à equipe o primeiro Pokémon da grade
    await expect(page.locator('article.pokemon-card').first()).toBeVisible({ timeout: 15_000 });
    const firstCard = page.locator('article.pokemon-card').first();
    const pokemonName = (await firstCard.locator('h3').innerText()).trim();

    const favoriteButton = firstCard.locator('button.outline');
    await favoriteButton.click();

    const teamButton = firstCard.locator('button.solid');
    await teamButton.click();

    // Navega até favoritos e valida o card
    await page.getByRole('link', { name: 'Favoritos' }).click();
    await expect(async () => {
      const titles = await page.locator('.favorite-card h3').allTextContents();
      expect(titles.some((title) => title.includes(pokemonName))).toBe(true);
    }).toPass({ timeout: 20_000 });

    // Navega até equipe e valida o slot
    await page.getByRole('link', { name: /^Equipe$/ }).click();
    await expect(async () => {
      const teamTitles = await page.locator('.team-card h3').allTextContents();
      expect(teamTitles.some((title) => title.includes(pokemonName))).toBe(true);
    }).toPass({ timeout: 20_000 });

    // Recarrega e valida que a sessão permanece ativa
    await page.reload();
    await expect(page.getByText(`Olá, ${username}`)).toBeVisible({ timeout: 10_000 });

    const sessionAfterReload = await page.evaluate(() => localStorage.getItem('kogui.auth'));
    expect(sessionAfterReload).not.toBeNull();
    const parsedAfterReload = JSON.parse(sessionAfterReload!);
    expect(parsedAfterReload.access).toBeTruthy();
    expect(parsedAfterReload.refresh).toBeTruthy();

    const screenshotPath = path.join(ARTIFACTS_DIR, `session-${username}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    test.info().attach('session-screenshot', {
      path: screenshotPath,
      contentType: 'image/png',
    });

    // Garante que favoritos e equipe continuam após reload
    await page.getByRole('link', { name: 'Favoritos' }).click();
    await expect(async () => {
      const titles = await page.locator('.favorite-card h3').allTextContents();
      expect(titles.some((title) => title.includes(pokemonName))).toBe(true);
    }).toPass({ timeout: 20_000 });
    await page.getByRole('link', { name: /^Equipe$/ }).click();
    await expect(async () => {
      const teamTitles = await page.locator('.team-card h3').allTextContents();
      expect(teamTitles.some((title) => title.includes(pokemonName))).toBe(true);
    }).toPass({ timeout: 20_000 });
  });
});
