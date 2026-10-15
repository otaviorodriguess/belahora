import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
async function openForm(page: Page, name: string) {
  await page.getByRole('button', { name: 'Novo agendamento', exact: true }).click();
  await page.getByLabel('Cliente', { exact: true }).fill(name);
  await page.getByLabel('Data', { exact: true }).fill('2026-10-02');
  await page.getByLabel('Horário', { exact: true }).fill('09:00');
}
async function navigate(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name, exact: true }).click();
}
test('persistência real: recarga, CRUD offline, exportação e restauração validada', async ({ page, context }) => {
  const remoteCalls: string[] = [];
  page.on('request', r => { if (/googleapis|accounts.google/.test(r.url())) remoteCalls.push(r.url()); });
  await page.goto('/');
  await expect(page.getByText('Carregando sua agenda…')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Um espaço na sua agenda' })).toBeVisible();
  await openForm(page, 'Maria Local');
  await page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await navigate(page, 'Buscar');
  const card = () => page.getByRole('button').filter({ hasText: 'Maria Local' });
  await expect(card()).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await navigate(page, 'Buscar');
  await card().click();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByLabel('Valor (R$)').fill('120');
  await page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload(); await navigate(page, 'Buscar');
  await expect(card()).toContainText('120,00');
  await navigate(page, 'Configurações');
  await page.getByLabel('Nome da profissional').fill('Profissional Offline');
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await expect(page.getByText('Tudo pronto. Sua rotina foi atualizada.')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup', exact: true }).click();
  const download = await downloadPromise;
  const content = await readFile((await download.path())!, 'utf8');
  const backup = JSON.parse(content);
  expect(backup.appointments).toHaveLength(1);
  expect(backup.settings.professional).toBe('Profissional Offline');
  await navigate(page, 'Buscar'); await card().click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Sim, cancelar' }).click();
  await page.reload(); await navigate(page, 'Buscar');
  await expect(card()).toHaveCount(0);
  await navigate(page, 'Configurações');
  const input = page.getByLabel('Selecionar arquivo de backup');
  await input.setInputFiles({ name: 'invalido.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"outra-coisa"}') });
  await expect(page.getByRole('alert')).toContainText('não é um backup compatível');
  await input.setInputFiles({ name: 'aura.json', mimeType: 'application/json', buffer: Buffer.from(content) });
  await expect(page.getByRole('dialog')).toContainText('1 agendamentos');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.getByText('0 agendamentos salvos')).toBeVisible();
  await input.setInputFiles({ name: 'aura.json', mimeType: 'application/json', buffer: Buffer.from(content) });
  await page.getByRole('button', { name: 'Restaurar e substituir' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload(); await navigate(page, 'Buscar');
  await expect(card()).toContainText('120,00');
  expect(remoteCalls).toEqual([]);
});

test('duas abas não conseguem reservar o mesmo horário', async ({ page, context }) => {
  const other = await context.newPage();
  await page.goto('/'); await other.goto('/');
  await openForm(page, 'Cliente Primeira'); await openForm(other, 'Cliente Segunda');
  await Promise.all([page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click(), other.getByRole('button', { name: 'Salvar agendamento', exact: true }).click()]);
  await expect.poll(async () => (await page.getByRole('dialog').count()) + (await other.getByRole('dialog').count())).toBe(1);
  const failed = (await page.getByRole('dialog').count()) ? page : other;
  await expect(failed.getByRole('alert')).toHaveText('Já existe um atendimento neste horário.');
  await failed.getByRole('button', { name: 'Voltar', exact: true }).click();
  await failed.reload(); await navigate(failed, 'Buscar');
  await expect(failed.locator('.appointment-card')).toHaveCount(1);
});

test('falha de gravação não confirma nem apaga registros anteriores', async ({ page }) => {
  await page.goto('/'); await openForm(page, 'Registro Preservado');
  await page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openForm(page, 'Falha Simulada');
  await page.getByLabel('Horário', { exact: true }).fill('11:00');
  await page.evaluate(() => { IDBObjectStore.prototype.put = () => { throw new DOMException('Quota', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.reload(); await navigate(page, 'Buscar');
  await expect(page.locator('.appointment-card')).toHaveCount(1);
  await expect(page.locator('.appointment-card')).toContainText('Registro Preservado');
});
