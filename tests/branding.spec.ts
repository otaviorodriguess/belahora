import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { adminDb } from '../server/firebaseAdmin';
import { defaults } from '../src/data/defaults';

test('salva foto e logo, mostra no link e remove sem alterar outra conta', async ({
  page,
  request,
  browser,
}) => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')
    throw Error('Local emulator required');
  const email = `branding-${Date.now()}@example.test`;
  const signup = await request.post(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
    { data: { email, password: 'Test-brand123!', returnSecureToken: true } },
  );
  const { localId: uid, idToken } = await signup.json();
  const db = adminDb(),
    code = crypto.randomUUID();
  const settings = {
    ...defaults,
    studio: 'Studio Aurora',
    professional: 'Ana · Estética',
    services: [{ id: 's', nome: 'Limpeza de pele', preco: 120, duracao: 60 }],
  };
  await db
    .doc(`accounts/${uid}`)
    .set({
      settings,
      settingsRevision: 1,
      migrationReady: true,
      publicEnabled: true,
      linkCode: code,
    });
  await db.doc(`bookingLinks/${code}`).set({ uid });
  await db
    .doc('accounts/other-branding')
    .set({ settings: { ...settings, studio: 'Outro espaço' } });
  await page.goto('/');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('Test-brand123!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('button', { name: 'Configurações', exact: true }).last().click();
  const photo = await sharp({
    create: { width: 900, height: 1200, channels: 3, background: '#b68e7d' },
  })
    .jpeg()
    .toBuffer();
  const logo = await sharp(
    Buffer.from(
      '<svg width="600" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="200" fill="#fffaf6"/><text x="300" y="135" text-anchor="middle" font-size="90" font-family="serif" fill="#85514f">Aurora</text></svg>',
    ),
  )
    .png()
    .toBuffer();
  await page
    .getByLabel('Enviar foto da profissional')
    .setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: photo });
  await expect(page.getByRole('img', { name: 'Prévia da foto', exact: true })).toBeVisible();
  await page
    .getByLabel('Enviar logo do espaço')
    .setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: logo });
  await expect(page.getByRole('img', { name: 'Prévia da logo', exact: true })).toBeVisible();
  await page.getByText('Ver prévia da apresentação').click();
  await page.getByRole('button', { name: 'Salvar aparência', exact: true }).click();
  await expect(page.getByText('Tudo pronto. Sua rotina foi atualizada.')).toBeVisible();
  const saved = (await db.doc(`accounts/${uid}`).get()).data()!;
  expect(saved.settings.professionalPhoto).toMatch(/^data:image\/webp;base64,/);
  expect(saved.settings.studioLogo).toMatch(/^data:image\/webp;base64,/);
  expect(saved.settings.professionalPhoto.length).toBeLessThan(140000);
  await page.screenshot({ path: 'work/branding-settings.png', fullPage: true });
  const visitor = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await visitor.addInitScript(() =>
    Object.assign(self, { FIREBASE_APPCHECK_DEBUG_TOKEN: 'test-debug' }),
  );
  await visitor.route('**/*firebaseappcheck.googleapis.com/**', (route) =>
    route.fulfill({ json: { token: 'test-proof', ttl: '3600s' } }),
  );
  const client = await visitor.newPage();
  await client.goto(`http://localhost:4181/agendar/${code}`);
  await expect(
    client.getByRole('img', { name: 'Logo de Studio Aurora', exact: true }),
  ).toBeVisible();
  await expect(
    client.getByRole('img', { name: 'Foto de Ana · Estética', exact: true }),
  ).toBeVisible();
  expect(await client.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await client.screenshot({ path: 'work/branding-public-mobile.png', fullPage: true });
  await client.setViewportSize({ width: 1440, height: 1000 });
  await client.screenshot({ path: 'work/branding-public-desktop.png', fullPage: true });
  const bad = await request.post('/api/agenda', {
    headers: { Authorization: `Bearer ${idToken}` },
    data: {
      action: 'settings',
      settings: { ...saved.settings, studioLogo: 'data:image/svg+xml;base64,PHN2Zz4=' },
      revision: saved.settingsRevision,
      operationId: crypto.randomUUID(),
    },
  });
  expect(bad.status()).toBe(400);
  await page.getByRole('button', { name: 'Remover foto', exact: true }).click();
  await page.getByRole('button', { name: 'Remover logo', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar aparência', exact: true }).click();
  await expect(page.getByText('Tudo pronto. Sua rotina foi atualizada.')).toBeVisible();
  await client.reload();
  await expect(client.getByRole('heading', { name: 'Studio Aurora' })).toBeVisible();
  await expect(client.getByRole('img', { name: 'Logo de Studio Aurora', exact: true })).toHaveCount(
    0,
  );
  await expect(
    client.getByRole('img', { name: 'Foto de Ana · Estética', exact: true }),
  ).toHaveCount(0);
  expect(
    (await db.doc('accounts/other-branding').get()).data()!.settings.studioLogo,
  ).toBeUndefined();
  await visitor.close();
});
