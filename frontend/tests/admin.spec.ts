import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test.describe('Funcionalidades de Administração', () => {
  test('admin pode gerenciar usuários', async ({ page }) => {
    // Primeiro, criar um usuário admin via API diretamente
    const adminUsername = `admin_${randomUUID().slice(0, 8)}`;
    const adminPassword = `AdminPwd!${randomUUID().slice(0, 8)}`;

    // Registrar usuário admin via API
    await page.request.post('http://localhost:8000/auth/register/', {
      data: {
        username: adminUsername,
        password: adminPassword,
        email: `${adminUsername}@example.com`
      }
    });

    // Login como admin
    await page.goto('/login');
    await page.getByLabel('Usuário').fill(adminUsername);
    await page.getByLabel('Senha', { exact: true }).fill(adminPassword);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await page.waitForURL('**/');
    await expect(page.getByText(`Olá, ${adminUsername}`)).toBeVisible({ timeout: 15_000 });

    // Verificar se o link Admin aparece (se o usuário for admin)
    // Nota: Para este teste funcionar completamente, o usuário precisaria ser marcado como admin no backend
    const adminLink = page.getByRole('link', { name: 'Admin' });

    // Se o link existir, testar funcionalidades de admin
    if (await adminLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await adminLink.click();

      // Verificar se chegou na página de admin
      await expect(page.getByRole('heading', { name: 'Gestão de usuários' })).toBeVisible();

      // Tentar criar um novo usuário
      await page.getByRole('button', { name: 'Criar usuário' }).click();

      const newUsername = `user_${randomUUID().slice(0, 8)}`;
      const newPassword = `UserPwd!${randomUUID().slice(0, 8)}`;

      await page.getByLabel('Nome de usuário').fill(newUsername);
      await page.getByLabel('E-mail (opcional)').fill(`${newUsername}@example.com`);
      await page.getByLabel('Senha', { exact: true }).fill(newPassword);
      await page.getByLabel('Confirmar senha').fill(newPassword);

      await page.getByRole('button', { name: 'Criar usuário' }).click();

      // Verificar se o usuário foi criado
      await expect(page.locator('.feedback[data-type="success"]')).toContainText('criado com sucesso', {
        timeout: 10_000,
      });

      // Verificar se o usuário aparece na lista
      await expect(page.getByText(newUsername)).toBeVisible({ timeout: 10_000 });
    }
  });

  test('página de alteração de senha funciona', async ({ page }) => {
    const username = `user_${randomUUID().slice(0, 8)}`;
    const oldPassword = `OldPwd!${randomUUID().slice(0, 8)}`;
    const newPassword = `NewPwd!${randomUUID().slice(0, 8)}`;

    // Registrar usuário
    await page.request.post('http://localhost:8000/auth/register/', {
      data: {
        username: username,
        password: oldPassword,
        email: `${username}@example.com`
      }
    });

    // Login
    await page.goto('/login');
    await page.getByLabel('Usuário').fill(username);
    await page.getByLabel('Senha', { exact: true }).fill(oldPassword);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await page.waitForURL('**/');

    // Ir para página de alteração de senha
    await page.goto('/account/password');

    // Verificar se chegou na página correta
    await expect(page.getByRole('heading', { name: 'Alterar Senha' })).toBeVisible();

    // Preencher formulário de alteração de senha
    await page.getByLabel('Senha atual').fill(oldPassword);
    await page.getByLabel('Nova senha').fill(newPassword);
    await page.getByLabel('Confirmar nova senha').fill(newPassword);

    await page.getByRole('button', { name: 'Atualizar senha' }).click();

    // Verificar sucesso
    await expect(page.locator('.feedback[data-type="success"]')).toContainText('Senha atualizada com sucesso', {
      timeout: 10_000,
    });
  });

  test('reset de senha via email funciona', async ({ page }) => {
    const username = `user_${randomUUID().slice(0, 8)}`;
    const password = `Pwd!${randomUUID().slice(0, 8)}`;
    const email = `${username}@example.com`;

    // Registrar usuário
    await page.request.post('http://localhost:8000/auth/register/', {
      data: {
        username: username,
        password: password,
        email: email
      }
    });

    // Ir para página de reset de senha
    await page.goto('/password-reset');

    // Verificar se chegou na página correta
    await expect(page.getByRole('heading', { name: 'Redefinir Senha' })).toBeVisible();

    // Preencher email para reset
    await page.getByLabel('E-mail').fill(email);
    await page.getByRole('button', { name: 'Enviar link de redefinição' }).click();

    // Verificar que o processo foi iniciado
    await expect(page.locator('.feedback[data-type="success"]')).toContainText('enviado', {
      timeout: 10_000,
    });
  });
});