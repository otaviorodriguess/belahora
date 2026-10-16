import { test, expect } from '@playwright/test';

import { formatInTimeZone } from 'date-fns-tz';

test('migra agenda, compartilha link e recebe reserva automática sem login da cliente', async ({
  page,

  context,

  request,
}) => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')
    throw new Error('Local emulator required');

  await request.delete(
    'http://127.0.0.1:8080/emulator/v1/projects/demo-belahora/databases/(default)/documents',
  );

  await request.delete('http://127.0.0.1:9099/emulator/v1/projects/demo-belahora/accounts');

  await request.post(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',

    { data: { email: 'cloud@example.test', password: 'Test-only123!', returnSecureToken: true } },
  );

  await page.goto('/');

  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('aura-local-agenda', 1);

      r.onupgradeneeded = () => r.result.createObjectStore('agenda');

      r.onsuccess = () => resolve(r.result);
    });

    await new Promise<void>((resolve) => {
      const tx = db.transaction('agenda', 'readwrite');

      tx.objectStore('agenda').put(
        {
          hoursExtendedTo20: true,

          appointments: [
            {
              id: 'preserved',

              nomeCliente: 'Cliente Antiga',

              telefone: '',

              servico: 'limpeza',

              valor: 100,

              data: '2025-01-01',

              horaInicio: '10:00',

              horaFim: '11:00',

              duracao: 60,

              observacoes: '',

              createdAt: '2025-01-01T13:00:00Z',

              updatedAt: '2025-01-01T13:00:00Z',
            },
          ],

          settings: {
            studio: 'Espaço Bela',

            professional: 'Ana',

            gap: 0,

            mode: 'local',

            hours: Array.from({ length: 7 }, () => ({
              active: true,

              start: '08:00',

              end: '20:00',
            })),

            services: [{ id: 'limpeza', nome: 'Limpeza de pele', preco: 120, duracao: 60 }],
          },

          updatedAt: '2025-01-01T13:00:00Z',
        },

        'current',
      );

      tx.oncomplete = () => resolve();
    });

    db.close();
  });

  await page.getByLabel('E-mail', { exact: true }).fill('cloud@example.test');

  await page.getByLabel('Senha', { exact: true }).fill('Test-only123!');

  await page.getByLabel('Manter acesso neste aparelho').check();

  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  await page.getByRole('button', { name: 'Configurações', exact: true }).last().click();

  await expect(page.getByRole('heading', { name: 'Link de agendamento' })).toBeVisible();

  await page

    .getByLabel('Conferi os agendamentos e atualizei todos os aparelhos usados na agenda.')

    .check();

  await page.getByRole('button', { name: 'Ativar link de agendamento' }).click();

  await expect(page.getByLabel('Seu link')).toHaveValue(/\/agendar\//);

  const url = await page.getByLabel('Seu link').inputValue();

  const visitor = await context.browser()!.newContext({
    viewport: { width: 390, height: 844 },

    locale: 'pt-BR',

    timezoneId: 'Asia/Tokyo',
  });

  await visitor.addInitScript(() => {
    Object.assign(self, { FIREBASE_APPCHECK_DEBUG_TOKEN: 'test-debug' });
  });

  await visitor.route('**/*firebaseappcheck.googleapis.com/**', (route) =>
    route.fulfill({ json: { token: 'test-proof', ttl: '3600s' } }),
  );

  const client = await visitor.newPage();

  await client.goto(url);

  await expect(client.getByRole('heading', { name: 'Espaço Bela' })).toBeVisible();

  await expect(client.getByRole('heading', { name: 'Entre na sua agenda' })).toHaveCount(0);

  await client.getByRole('button', { name: /Limpeza de pele/ }).click();

  await client

    .getByLabel('Dia', { exact: true })

    .fill(formatInTimeZone(Date.now() + 86400000, 'America/Sao_Paulo', 'yyyy-MM-dd'));

  await client.getByRole('button', { name: '09:00', exact: true }).click();

  await client.getByLabel('Seu nome').fill('Cliente do Link');

  await client.getByLabel('Telefone com DDD').fill('11988887777');

  await client.screenshot({ path: 'work/booking-mobile.png', fullPage: true });

  await client.getByRole('button', { name: 'Revisar agendamento' }).click();

  await client.getByRole('button', { name: 'Confirmar agendamento' }).click();

  await expect(client.getByRole('heading', { name: 'Seu horário está reservado.' })).toBeVisible();

  await page

    .getByRole('navigation', { name: 'Navegação principal' })

    .getByRole('button', { name: 'Buscar', exact: true })

    .click();

  await expect(page.getByText('Cliente do Link', { exact: true })).toBeVisible();

  await expect(page.getByText('Cliente Antiga', { exact: true })).toBeVisible();

  const second = await context.browser()!.newContext();

  const other = await second.newPage();

  await other.goto('/');

  await other.getByLabel('E-mail', { exact: true }).fill('cloud@example.test');

  await other.getByLabel('Senha', { exact: true }).fill('Test-only123!');

  await other.getByRole('button', { name: 'Entrar', exact: true }).click();

  await other

    .getByRole('navigation', { name: 'Navegação principal' })

    .getByRole('button', { name: 'Buscar', exact: true })

    .click();

  await expect(other.getByText('Cliente do Link', { exact: true })).toBeVisible();

  await expect(other.getByText('Cliente Antiga', { exact: true })).toBeVisible();

  await other.setViewportSize({ width: 1360, height: 900 });

  await other.screenshot({ path: 'work/booking-owner-desktop.png', fullPage: true });

  await second.setOffline(true);

  await expect(
    other.getByText('Sem internet · Consulta disponível; alterações precisam de conexão'),
  ).toBeVisible();

  // A new device with no remote cache must not present an empty agenda when Firestore fails.

  const unavailable = await context.browser()!.newContext();

  await unavailable.route('**/google.firestore.v1.Firestore/**', (r) => r.abort());

  const unavailablePage = await unavailable.newPage();

  await unavailablePage.goto('/');

  await unavailablePage.getByLabel('E-mail', { exact: true }).fill('cloud@example.test');

  await unavailablePage.getByLabel('Senha', { exact: true }).fill('Test-only123!');

  await unavailablePage.getByRole('button', { name: 'Entrar', exact: true }).click();

  await expect(unavailablePage.getByText('Armazenamento indisponível')).toBeVisible({
    timeout: 20000,
  });

  await expect(unavailablePage.getByText('Sua agenda ainda não foi carregada.')).toBeVisible();

  await unavailable.close();

  await second.close();

  await page.getByRole('button', { name: 'Configurações', exact: true }).last().click();

  const downloadEvent = page.waitForEvent('download');

  await page.getByRole('button', { name: 'Exportar backup', exact: true }).click();

  const download = await downloadEvent;

  const fs = await import('node:fs/promises');

  const backup = JSON.parse(await fs.readFile((await download.path())!, 'utf8'));

  const original = backup.appointments[0];

  backup.appointments = Array.from({ length: 51 }, (_, i) => ({
    ...original,
    id: `resume-${i}`,
    nomeCliente: `Recuperada ${i}`,

    data: new Date(Date.UTC(2024, 0, i + 1)).toISOString().slice(0, 10),
  }));

  let chunks = 0;

  await page.route('**/api/agenda', async (route) => {
    if (route.request().postDataJSON()?.action === 'import-records' && ++chunks === 2)
      await route.fulfill({ status: 503, json: { message: 'Interrupção de teste' } });
    else await route.continue();
  });

  await page.getByLabel('Selecionar arquivo de backup').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });

  await page.getByRole('button', { name: 'Importar e conferir' }).click();

  // The first 50-record transaction batch can exceed 5s on the local emulator.
  await expect.poll(() => chunks, { timeout: 20000 }).toBe(2);

  await page.unroute('**/api/agenda');

  await page.reload();

  await page.getByRole('button', { name: 'Configurações', exact: true }).last().click();

  await expect(page.getByRole('heading', { name: 'Conferência da agenda' })).toHaveCount(0, {
    timeout: 20000,
  });

  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('button', { name: 'Buscar', exact: true })
    .click();

  await page.getByPlaceholder(/nome/i).fill('Recuperada 50');

  await expect(page.getByText('Recuperada 50', { exact: true })).toBeVisible();

  await visitor.close();
});
