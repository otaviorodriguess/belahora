import { test, expect } from '@playwright/test';

test('atalhos, escolha de horário e proteção do formulário no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('Ir para uma data').fill('2026-10-02');
  await page.getByRole('button', { name: 'Novo agendamento', exact: true }).click();
  await expect(page.getByLabel('Data', { exact: true })).toHaveValue('2026-10-02');
  await page.getByLabel('Cliente', { exact: true }).fill('Ana Experiência');
  await page.getByRole('button', { name: /^Tarde/ }).click();
  await page.getByRole('button', { name: '14:00', exact: true }).click();
  await expect(page.getByLabel('Horário', { exact: true })).toHaveValue('14:00');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Descartar alterações?' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar editando' }).click();
  await expect(page.getByLabel('Cliente', { exact: true })).toHaveValue('Ana Experiência');
  await page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.appointment-card')).toContainText('Ana Experiência');
  await page.screenshot({ path: 'work/mobile-filled.png', fullPage: true });
  await page.getByRole('button', { name: 'Novo agendamento', exact: true }).click();
  await expect(page.getByRole('button', { name: '14:00', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  for (const width of [320, 360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
