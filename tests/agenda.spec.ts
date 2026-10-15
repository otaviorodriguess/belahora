import { test, expect, chromium } from '@playwright/test';
test('desktop: criar, rejeitar conflito, editar, reagendar, buscar e cancelar', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Agenda.', exact: true })).toBeVisible();
  await page.screenshot({ path: 'work/desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Novo agendamento', exact: true }).click();
  await page.getByLabel('Cliente', { exact: true }).fill('Cliente Teste');
  await page.getByLabel('Telefone').fill('88999999999');
  await page.getByLabel('Data', { exact: true }).fill('2026-10-02');
  await page.getByLabel('Horário', { exact: true }).fill('09:00');
  await page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const appointment = page.locator('.appointment-card').filter({ hasText: 'Cliente Teste' });
  await expect(appointment).toBeVisible();
  await page.getByRole('button', { name: 'Novo agendamento', exact: true }).click();
  await page.getByLabel('Cliente', { exact: true }).fill('Conflito Teste');
  await page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Já existe um atendimento neste horário.');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await appointment.click();
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
    'href',
    /wa\.me\/5588999999999/,
  );
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByLabel('Procedimento').selectOption('dermaplaning');
  await expect(page.getByLabel('Valor (R$)')).toHaveValue('80');
  await expect(page.getByLabel('Duração (min)')).toHaveValue('45');
  await page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click();
  await appointment.click();
  await page.getByRole('button', { name: 'Reagendar', exact: true }).click();
  await page.getByLabel('Horário', { exact: true }).fill('13:00');
  await page.getByRole('button', { name: 'Confirmar novo horário' }).click();
  await expect(appointment).toContainText('13:00');
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('button', { name: 'Buscar' })
    .click();
  await page.getByRole('searchbox').fill('cliente teste');
  await expect(appointment).toBeVisible();
  await appointment.click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Sim, cancelar' }).click();
  await expect(page.getByRole('heading', { name: 'Nenhum atendimento encontrado' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile: calendário, navegação, configurações e formulário sem transbordamento', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.screenshot({ path: 'work/mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Semana', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Agendamentos da semana' })).toBeVisible();
  await page.getByRole('button', { name: 'Dia', exact: true }).click();
  await page.getByRole('button', { name: 'Hoje', exact: true }).click();
  const nav = page.getByRole('navigation', { name: 'Navegação mobile' });
  await nav.getByRole('button', { name: 'Início', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Resumo financeiro' })).toBeVisible();
  await nav.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByLabel('Nome da profissional').fill('Renata');
  await page.getByLabel('Nome do espaço').fill('Studio Renata');
  await page.getByLabel('Intervalo entre atendimentos').fill('10');
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await expect(page.getByText('Tudo pronto. Sua rotina foi atualizada.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await nav.getByRole('button', { name: 'Configurações', exact: true }).click();
  await expect(page.getByLabel('Nome da profissional')).toHaveValue('Renata');
  await page.getByRole('button', { name: 'Novo agendamento', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: 'work/mobile-form.png', fullPage: true });
  expect(await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  for (const width of [320, 360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test('PWA: manifest, ícones, service worker e abertura offline', async ({
  page,
  context,
  request,
}) => {
  await page.goto('/');
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).status()).toBe(200);
  }
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Agenda.', exact: true })).toBeVisible();
  await expect(
    page.getByText('Sem internet · Seus agendamentos continuam sendo salvos neste aparelho.'),
  ).toBeVisible();
});

test('PWA: Chrome permite instalação em perfil normal', async () => {
  // A instalação é desativada em contextos anônimos. Perfil isolado e temporário.
  const context = await chromium.launchPersistentContext('', {
    channel: 'chrome',
    headless: true,
    baseURL: 'http://127.0.0.1:4173',
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    const cdp = await context.newCDPSession(page);
    const result = await cdp.send('Page.getInstallabilityErrors');
    expect(result.installabilityErrors).toEqual([]);
  } finally {
    await context.close();
  }
});
