import { test, expect, type Page, type Route } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const emulator = 'http://127.0.0.1:9099';
const project = 'demo-belahora';
const password = 'Test-only-pass123!';
let userAId = '';

test('nova conta cadastra seus serviços a partir de catálogo vazio', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await settings(page);
  await expect(page.getByText('Adicione seu primeiro serviço para começar a agendar.')).toBeVisible();
  await page.getByRole('button', { name: 'Adicionar serviço', exact: true }).click();
  await page.getByLabel('Nome do serviço', { exact: true }).fill('Meu serviço');
  await page.getByRole('button', { name: 'Salvar serviços', exact: true }).click();
  await expect(page.getByText('Tudo pronto. Sua rotina foi atualizada.')).toBeVisible();
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await login(page, 'b@example.test');
  await settings(page);
  await expect(page.getByText('Adicione seu primeiro serviço para começar a agendar.')).toBeVisible();
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await login(page);
  await settings(page);
  await expect(page.getByText('Meu serviço', { exact: true })).toBeVisible();
});
test('saída também encerra outra aba com sessão somente em memória', async ({ page, context }) => {
  await page.goto('/');
  await login(page);
  await settings(page);
  const other = await context.newPage();
  await other.goto('/');
  await login(other);
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(other.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
});
test('armazenamento negado não confirma manter acesso', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('firebase:'))
        throw new DOMException('Storage denied', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.getByLabel('E-mail', { exact: true }).fill('a@example.test');
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByLabel('Manter acesso neste aparelho').check();
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo agendamento', exact: true })).toHaveCount(0);
});
test('revisão: resposta atrasada da sessão A não encerra sessão B', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await settings(page);
  let deliver: (route: Route) => void = () => {};
  const pending = new Promise<Route>((resolve) => {
    deliver = resolve;
  });
  await page.route('**/securetoken.googleapis.com/v1/token**', (route) => deliver(route));
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  const route = await pending;
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await login(page, 'b@example.test');
  await settings(page);
  await route.fulfill({
    status: 400,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 400, message: 'TOKEN_EXPIRED' } }),
  });
  await page.waitForTimeout(500);
  await expect(page.getByText('b@example.test', { exact: true })).toBeVisible();
});
test('revisão: exportação pendente não baixa dados depois da saída em outra aba', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await login(page, 'a@example.test', true);
  await settings(page);
  const other = await context.newPage();
  await other.goto('/');
  await settings(other);
  await page.evaluate(() => {
    const original = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete')!;
    Object.defineProperty(IDBTransaction.prototype, 'oncomplete', {
      configurable: true,
      get: original.get,
      set(this: IDBTransaction, handler: (event: Event) => void) {
        original.set!.call(this, (event: Event) => {
          if (this.db.name === 'aura-local-agenda' && this.mode === 'readonly')
            setTimeout(() => handler.call(this, event), 1800);
          else handler.call(this, event);
        });
      },
    });
  });
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.getByRole('button', { name: 'Exportar backup', exact: true }).click();
  await other.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  await page.waitForTimeout(2100);
  expect(downloads).toBe(0);
});
test('entrada direta preserva instalação antiga com cache Google', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.setItem(
      'aura.settings.v1',
      JSON.stringify({
        studio: 'Espaço Legado',
        professional: 'Ana',
        gap: 0,
        cachedCalendarId: 'old-calendar',
        hours: Array.from({ length: 7 }, () => ({ active: true, start: '08:00', end: '20:00' })),
      }),
    );
    const cache = await caches.open('aura-agenda-snapshot-v1');
    await cache.put(
      `${location.origin}/__aura_snapshot__/old-calendar`,
      new Response(
        JSON.stringify({
          appointments: [
            {
              id: 'legacy',
              nomeCliente: 'Cliente Google',
              telefone: '',
              servico: 'servico',
              valor: 100,
              data: '2026-10-12',
              horaInicio: '10:00',
              horaFim: '11:00',
              duracao: 60,
              observacoes: '',
              createdAt: '2026-10-08T12:00:00Z',
              updatedAt: '2026-10-08T12:00:00Z',
            },
          ],
          busy: [],
          syncedAt: '2026-10-08T12:00:00Z',
        }),
      ),
    );
  });
  await page.getByLabel('E-mail', { exact: true }).fill('a@example.test');
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Novo agendamento', exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('button', { name: 'Buscar', exact: true })
    .click();
  await expect(page.getByText('Cliente Google', { exact: true })).toBeVisible();
});
async function login(page: Page, email = 'a@example.test', remember = false) {
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  if (remember) await page.getByLabel('Manter acesso neste aparelho').check();
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Novo agendamento', exact: true }).first(),
  ).toBeVisible();
}
async function settings(page: Page) {
  await page.getByRole('button', { name: 'Configurações', exact: true }).last().click();
}
test.beforeEach(async ({ request, context, baseURL }) => {
  if (!project.startsWith('demo-') || new URL(emulator).hostname !== '127.0.0.1')
    throw new Error('Unsafe test target');
  await request.delete(`${emulator}/emulator/v1/projects/${project}/accounts`);
  for (const email of ['a@example.test', 'b@example.test']) {
    const response = await request.post(
      `${emulator}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`,
      { data: { email, password, returnSecureToken: true } },
    );
    expect(response.ok()).toBeTruthy();
    if (email === 'a@example.test') userAId = (await response.json()).localId;
  }
  if (baseURL?.includes(':4180')) {
    // Real Firebase SDK + real Auth Emulator. Only transport is redirected in tests.
    await context.route(
      /^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\//,
      async (route) => {
        const url = new URL(route.request().url());
        const response = await route.fetch({
          url: `${emulator}/${url.hostname}${url.pathname}${url.search}`,
        });
        await route.fulfill({ response });
      },
    );
  }
});
test('entrada direta, exportação e preservação após atualização', async ({ page }) => {
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
              servico: 'servico',
              valor: 100,
              data: '2026-10-12',
              horaInicio: '10:00',
              horaFim: '11:00',
              duracao: 60,
              observacoes: '',
              createdAt: '2026-10-08T12:00:00Z',
              updatedAt: '2026-10-08T12:00:00Z',
            },
          ],
          settings: {
            studio: 'Espaço Antigo',
            professional: 'Ana',
            mode: 'local',
            gap: 0,
            hours: Array.from({ length: 7 }, () => ({
              active: true,
              start: '08:00',
              end: '20:00',
            })),
          },
          updatedAt: '2026-10-08T12:00:00Z',
        },
        'current',
      );
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  await page.getByLabel('E-mail', { exact: true }).fill('a@example.test');
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByLabel('Manter acesso neste aparelho').check();
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Novo agendamento', exact: true }).first(),
  ).toBeVisible();
  await settings(page);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup', exact: true }).click();
  const download = await pending;
  const backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(backup.appointments[0].nomeCliente).toBe('Cliente Antiga');
  await expect(page.getByLabel('Nome do espaço')).toHaveValue('Espaço Antigo');
  await page.reload();
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('button', { name: 'Buscar', exact: true })
    .click();
  await expect(page.getByText('Cliente Antiga', { exact: true })).toBeVisible();
  await settings(page);
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await login(page, 'b@example.test');
  await expect(
    page.getByRole('heading', { name: 'Encontramos uma agenda neste aparelho' }),
  ).toHaveCount(0);
  await settings(page);
  await expect(page.getByLabel('Nome do espaço')).toHaveValue('Meu espaço de beleza');
});
test('tela de entrada cabe no celular e mantém labels acessíveis', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Entre na sua agenda' })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: 'work/firebase-login-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.screenshot({ path: 'work/firebase-login-desktop.png', fullPage: true });
});
test('PWA reabre offline com sessão mantida e permite salvar', async ({
  page,
  context,
  baseURL,
}) => {
  test.skip(!baseURL?.includes(':4180'), 'Requires production service worker');
  await page.goto('/');
  await login(page, 'a@example.test', true);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await context.unrouteAll({ behavior: 'wait' });
  await context.setOffline(true);
  await page.reload();
  await settings(page);
  await page.getByLabel('Nome do espaço').fill('Salvo offline');
  await page.getByRole('button', { name: 'Salvar configurações', exact: true }).click();
  await expect(page.getByText('Tudo pronto. Sua rotina foi atualizada.')).toBeVisible();
  await page.reload();
  await settings(page);
  await expect(page.getByLabel('Nome do espaço')).toHaveValue('Salvo offline');
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
});
test('PWA sem manter acesso não abre agenda após recarregar offline', async ({
  page,
  context,
  baseURL,
}) => {
  test.skip(!baseURL?.includes(':4180'), 'Requires production service worker');
  await page.goto('/');
  await login(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await context.unrouteAll({ behavior: 'wait' });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
});
test('login, separação de configurações, saída e nenhuma persistência por padrão', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByLabel('Manter acesso neste aparelho')).not.toBeChecked();
  await expect(page.getByRole('button', { name: /criar conta|cadastrar/i })).toHaveCount(0);
  await login(page);
  await settings(page);
  await page.getByLabel('Nome do espaço').fill('Espaço da conta A');
  await page.getByRole('button', { name: 'Salvar configurações', exact: true }).click();
  await expect(page.getByText('Tudo pronto. Sua rotina foi atualizada.')).toBeVisible();
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await login(page, 'b@example.test');
  await settings(page);
  await expect(page.getByLabel('Nome do espaço')).toHaveValue('Meu espaço de beleza');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  await login(page);
  await settings(page);
  await expect(page.getByLabel('Nome do espaço')).toHaveValue('Espaço da conta A');
});
test('sessão mantida restaura e saída bloqueia outra aba', async ({ page, context }) => {
  await page.goto('/');
  await login(page, 'a@example.test', true);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Novo agendamento', exact: true }).first(),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto('/');
  await expect(
    other.getByRole('button', { name: 'Novo agendamento', exact: true }).first(),
  ).toBeVisible();
  await settings(page);
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(other.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
});
test('credenciais inválidas e recuperação sem envio real', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail', { exact: true }).fill('a@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('E-mail ou senha');
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  await page.getByRole('button', { name: 'Enviar recuperação' }).click();
  await expect(page.getByRole('status')).toContainText('Se houver uma conta');
});
test('conta desativada é bloqueada ao retomar online', async ({ page, request }) => {
  await page.goto('/');
  await login(page, 'a@example.test', true);
  const response = await request.post(
    `${emulator}/identitytoolkit.googleapis.com/v1/projects/${project}/accounts:update`,
    {
      headers: { Authorization: 'Bearer owner' },
      data: { localId: userAId, disableUser: true },
    },
  );
  expect(response.ok()).toBeTruthy();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
});
test('falha de rede mantém formulário e não vira senha incorreta', async ({ page, context }) => {
  await page.goto('/');
  await login(page);
  await page.getByRole('button', { name: 'Novo agendamento', exact: true }).click();
  await page.getByLabel('Cliente', { exact: true }).fill('Edição em andamento');
  await context.setOffline(true);
  await expect(page.getByLabel('Cliente', { exact: true })).toHaveValue('Edição em andamento');
  await expect(page.getByRole('dialog')).toBeVisible();
});
test('atualização real do service worker preserva atendimento da versão anterior', async ({
  page,
  request,
  baseURL,
}) => {
  test.skip(!baseURL?.includes(':4180'), 'Requires production PWA and historical build');
  test.setTimeout(90000);
  const switched = await request.post(`${baseURL}/__test_upgrade__/old`);
  test.skip(switched.status() === 404, 'Historical recovery copy not present in this checkout');
  expect(switched.ok()).toBeTruthy();
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Novo agendamento', exact: true }).click();
    await page.getByLabel('Cliente', { exact: true }).fill('Preservada na atualização');
    await page.getByLabel('Data', { exact: true }).fill('2026-10-12');
    await page.getByLabel('Horário', { exact: true }).fill('10:00');
    await page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await request.post(`${baseURL}/__test_upgrade__/new`);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });
    await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Entre na sua agenda' })).toBeVisible();
    await page.getByLabel('E-mail', { exact: true }).fill('a@example.test');
    await page.getByLabel('Senha', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Novo agendamento', exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('button', { name: 'Buscar', exact: true })
      .click();
    await expect(page.getByText('Preservada na atualização', { exact: true })).toBeVisible();
  } finally {
    await request.post(`${baseURL}/__test_upgrade__/new`);
  }
});
