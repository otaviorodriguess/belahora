import { test, expect } from '@playwright/test';
import { adminDb } from '../server/firebaseAdmin';
import { defaults } from '../src/data/defaults';
import { formatInTimeZone } from 'date-fns-tz';

test('demonstração é somente leitura e não reivindica agenda antiga', async ({ page, request }) => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw Error('Local emulator only');
  const email = `demo-${Date.now()}@example.test`;
  const registration = await request.post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', { data: { email, password: 'Demo-test123!', returnSecureToken: true } });
  const { localId: uid, idToken } = await registration.json();
  const db = adminDb();
  const date = formatInTimeZone(Date.now(), 'America/Sao_Paulo', 'yyyy-MM-dd');
  await db.doc(`accounts/${uid}`).set({ readOnly: true, settings: { ...defaults, studio: 'Espaço demonstração', services: [{ id: 's', nome: 'Limpeza de pele', preco: 100, duracao: 60 }] }, migrationReady: true, settingsRevision: 1, publicEnabled: false, linkCode: null });
  await db.doc(`accounts/${uid}/appointments/demo`).set({ origin: 'owner', revision: 1, status: 'confirmed', value: { id: 'demo', nomeCliente: 'Cliente Fictícia', telefone: '', servico: 's', serviceNames: ['Limpeza de pele'], valor: 100, data: date, horaInicio: '09:00', horaFim: '10:00', duracao: 60, observacoes: 'Exemplo fictício', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
  await page.goto('/');
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('aura-local-agenda', 1); r.onupgradeneeded = () => r.result.createObjectStore('agenda'); r.onsuccess = () => resolve(r.result); });
    await new Promise<void>(resolve => { const tx = db.transaction('agenda', 'readwrite'); tx.objectStore('agenda').put({ appointments: [], settings: { studio: 'AGENDA REAL NÃO IMPORTAR', professional: '', services: [], mode: 'local', gap: 0, hours: [] }, updatedAt: '2026-01-01' }, 'current'); tx.oncomplete = () => resolve(); }); db.close();
  });
  let writes = 0;
  page.on('request', r => { if (r.url().endsWith('/api/agenda')) writes++; });
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('Demo-test123!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByText('Demonstração · Somente leitura · Todos os dados são fictícios.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo agendamento', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Configurações', exact: true }).last().click();
  await expect(page.getByLabel('Nome do espaço', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Salvar configurações', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Importar backup/ })).toHaveCount(0);
  expect(writes).toBe(0);
  expect((await db.collection(`accounts/${uid}/imports`).get()).size).toBe(0);
  for (const action of ['mutate', 'settings', 'link', 'import-start', 'import-records', 'import-complete', 'import-resolve']) {
    const denied = await request.post('/api/agenda', { headers: { Authorization: `Bearer ${idToken}` }, data: { action } });
    expect(denied.status()).toBe(403); expect((await denied.json()).code).toBe('READ_ONLY');
  }
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
});
