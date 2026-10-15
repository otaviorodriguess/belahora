import { test, expect } from '@playwright/test';
test('vários procedimentos somam tempo e valor, persistem e bloqueiam todo o período', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Novo agendamento', exact: true }).click();
  await page.getByLabel('Cliente', { exact: true }).fill('Cliente Combo');
  await page.getByLabel('Data', { exact: true }).fill('2026-10-02');
  await page.getByRole('button', { name: '+ Adicionar procedimento', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Procedimento 2', exact: true })).toHaveValue('dermaplaning');
  await expect(page.getByLabel('Valor (R$)')).toHaveValue('180');
  await expect(page.getByLabel('Duração (min)')).toHaveValue('105');
  await expect(page.getByText('Término previsto:')).toContainText('10:45');
  await page.screenshot({ path: 'work/multiple-services.png', fullPage: true });
  await page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await page.getByLabel('Ir para uma data').fill('2026-10-02');
  const card = page.locator('.appointment-card').filter({ hasText: 'Cliente Combo' });
  await expect(card).toContainText('Limpeza de pele + Dermaplaning');
  await card.click();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Procedimento 2', exact: true })).toHaveValue('dermaplaning');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.getByRole('button', { name: 'Novo agendamento', exact: true }).click();
  await page.getByLabel('Cliente', { exact: true }).fill('Conflito Combo');
  await page.getByLabel('Horário', { exact: true }).fill('10:00');
  await page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Já existe');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await card.click();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByRole('button', { name: 'Remover procedimento 2', exact: true }).click();
  await expect(page.getByLabel('Valor (R$)')).toHaveValue('100');
  await expect(page.getByLabel('Duração (min)')).toHaveValue('60');
  await page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click();
  await expect(card).not.toContainText('Dermaplaning');
});

