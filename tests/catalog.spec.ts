import { test, expect } from '@playwright/test';
test('catálogo editável persiste e preserva os atendimentos anteriores', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const settings = () =>
    page
      .getByRole('navigation', { name: 'Navegação mobile' })
      .getByRole('button', { name: 'Configurações', exact: true })
      .click();
  await settings();
  await page.getByRole('button', { name: 'Adicionar serviço', exact: true }).click();
  const open = page.locator('.catalog-list details[open]');
  await open.getByLabel('Nome do serviço', { exact: true }).fill('Massagem relaxante');
  await open.getByLabel('Preço (R$)', { exact: true }).fill('150');
  await open.getByLabel('Duração (minutos)', { exact: true }).fill('90');
  await page.screenshot({ path: 'work/catalog-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Salvar configurações', exact: true }).click();
  await expect(page.getByText('Tudo pronto. Sua rotina foi atualizada.')).toBeVisible();
  await page.reload();
  await settings();
  await expect(page.locator('.catalog-list')).toContainText('Massagem relaxante');
  await page.getByRole('button', { name: 'Novo agendamento', exact: true }).click();
  await page.getByLabel('Cliente', { exact: true }).fill('Cliente Catálogo');
  await page.getByLabel('Data', { exact: true }).fill('2026-10-02');
  const option = page.getByRole('option').filter({ hasText: 'Massagem relaxante' });
  const id = await option.getAttribute('value');
  await page.getByRole('combobox', { name: 'Procedimento', exact: true }).selectOption(id!);
  await expect(page.getByLabel('Valor (R$)')).toHaveValue('150');
  await expect(page.getByLabel('Duração (min)')).toHaveValue('90');
  await page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('summary').filter({ hasText: 'Massagem relaxante' }).click();
  await open.getByLabel('Nome do serviço', { exact: true }).fill('Massagem especial');
  await open.getByLabel('Preço (R$)', { exact: true }).fill('200');
  await open.getByLabel('Disponível para agendar').uncheck();
  await page.getByRole('button', { name: 'Salvar configurações', exact: true }).click();
  await expect(page.getByText('Tudo pronto. Sua rotina foi atualizada.')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Navegação mobile' })
    .getByRole('button', { name: 'Agenda', exact: true })
    .click();
  await expect(page.locator('.appointment-card')).toContainText('Massagem relaxante');
  await expect(page.locator('.appointment-card')).toContainText('150,00');
  await page.getByRole('button', { name: 'Novo agendamento', exact: true }).click();
  await expect(page.getByRole('option').filter({ hasText: 'Massagem especial' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await settings();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'work/catalog-desktop.png', fullPage: true });
});
