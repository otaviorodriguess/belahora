import { it, expect } from 'vitest';

import {
  startImport,
  importRecords,
  completeImport,
  resolveImport,
} from '../../server/importService';

import { adminDb } from '../../server/firebaseAdmin';

import { hash } from '../../server/agendaService';

import { defaults } from '../../src/data/defaults';
import { getPublicCatalog } from '../../server/publicBooking';

it('reativa um link que estava ativo após concluir a restauração, sem ativar um link já pausado', async () => {
  for (const wasEnabled of [true, false]) {
    const uid = `resume-${crypto.randomUUID()}`;
    const code = `link-${crypto.randomUUID()}`;
    const batchId = crypto.randomUUID();
    const account = adminDb().doc(`accounts/${uid}`);
    await account.set({
      settings: defaults,
      settingsRevision: 2,
      migrationReady: true,
      publicEnabled: wasEnabled,
      linkCode: code,
      activeBatch: null,
    });
    await adminDb().doc(`bookingLinks/${code}`).set({ uid });
    await startImport(uid, { batchId, count: 0, root: hash([]), settings: defaults });
    expect((await account.get()).data()?.publicEnabled).toBe(false);
    await completeImport(uid, batchId);
    expect((await account.get()).data()?.publicEnabled).toBe(wasEnabled);
    if (wasEnabled) await expect(getPublicCatalog(code)).resolves.toHaveProperty('studio');
    else await expect(getPublicCatalog(code)).rejects.toThrow('não está recebendo novas reservas');
  }
});

it('recupera catálogo antigo quando outro aparelho iniciou a nuvem vazia, sem sobrescrever edições', async () => {
  const uid = `catalog-${crypto.randomUUID()}`;
  const account = adminDb().doc(`accounts/${uid}`);
  const empty = {
    batchId: crypto.randomUUID(),
    count: 0,
    root: hash([]),
    settings: { ...defaults, services: [] },
  };
  await startImport(uid, empty);
  await completeImport(uid, empty.batchId);
  const old = {
    ...empty,
    batchId: crypto.randomUUID(),
    settings: {
      ...defaults,
      studio: 'Espaço preservado',
      services: [{ id: 'old', nome: 'Serviço existente', preco: 70, duracao: 30 }],
    },
  };
  await startImport(uid, old);
  await completeImport(uid, old.batchId);
  expect((await account.get()).data()?.settings).toEqual(old.settings);
  expect((await account.collection('imports').doc(old.batchId).get()).data()?.settings).toEqual(
    old.settings,
  );
  await account.update({
    settings: { ...defaults, studio: 'Editado na nuvem', services: [] },
    settingsRevision: 3,
  });
  await startImport(uid, { ...old, batchId: crypto.randomUUID() });
  expect((await account.get()).data()?.settings.studio).toBe('Editado na nuvem');
  expect((await account.get()).data()?.settings.services).toEqual([]);
});

it('importa sem duplicar, confere conteúdo e mantém cancelamento remoto', async () => {
  const uid = `import-${crypto.randomUUID()}`,
    batchId = crypto.randomUUID();

  const value = {
    id: 'old',

    nomeCliente: 'Preservada',

    telefone: '',

    servico: 's',

    valor: 30,

    data: '2025-01-01',

    horaInicio: '10:00',

    horaFim: '11:00',

    duracao: 60,

    observacoes: '',

    createdAt: '2025-01-01',

    updatedAt: '2025-01-01',
  };

  const manifest = {
    batchId,

    count: 1,

    root: hash([['old', hash(value)]]),

    settings: { ...defaults, services: [] },
  };

  await startImport(uid, manifest);

  await importRecords(uid, batchId, [value]);

  await importRecords(uid, batchId, [value]);

  await completeImport(uid, batchId);

  expect(
    (await adminDb().doc(`accounts/${uid}/appointments/old`).get()).data()?.value.nomeCliente,
  ).toBe('Preservada');

  await adminDb().doc(`accounts/${uid}/appointments/old`).update({ status: 'cancelled' });

  const next = { ...manifest, batchId: crypto.randomUUID() };

  await startImport(uid, next);

  await importRecords(uid, next.batchId, [value]);

  await expect(completeImport(uid, next.batchId)).rejects.toThrow();

  expect((await adminDb().doc(`accounts/${uid}/appointments/old`).get()).data()?.status).toBe(
    'cancelled',
  );
});

it('permite corrigir um registro antigo mantendo a cópia original', async () => {
  const uid = `resolve-${crypto.randomUUID()}`,
    batchId = crypto.randomUUID();

  const value = {
    id: 'old',

    nomeCliente: 'Recuperada',

    telefone: '',

    servico: 's',

    valor: 30,

    data: 'inválida',

    horaInicio: '10:00',

    horaFim: '11:00',

    duracao: 60,

    observacoes: '',

    createdAt: '2025-01-01',

    updatedAt: '2025-01-01',
  };

  await startImport(uid, {
    batchId,

    count: 1,

    root: hash([['old', hash(value)]]),

    settings: { ...defaults, services: [] },
  });

  await importRecords(uid, batchId, [value]);

  await resolveImport(uid, batchId, 'old', { ...value, data: '2026-10-12' });

  await completeImport(uid, batchId);

  const records = await adminDb().collection(`accounts/${uid}/appointments`).get();

  expect(records.size).toBe(1);

  expect(records.docs[0].data().value.data).toBe('2026-10-12');

  expect(
    (await adminDb().doc(`accounts/${uid}/imports/${batchId}/items/old`).get()).data()?.value.data,
  ).toBe('inválida');
});

it('ignora etag de transporte ao restaurar atendimento idêntico', async () => {
  const uid = `same-${crypto.randomUUID()}`,
    batchId = crypto.randomUUID();

  const value = {
    id: 'same',
    nomeCliente: 'Cliente',
    telefone: '',
    servico: 's',
    valor: 30,

    data: '2025-01-01',
    horaInicio: '10:00',
    horaFim: '11:00',
    duracao: 60,

    observacoes: '',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  };

  await adminDb()
    .doc(`accounts/${uid}`)
    .set({ settings: { ...defaults, services: [] }, migrationReady: true });

  await adminDb()
    .doc(`accounts/${uid}/appointments/same`)
    .set({
      value: { ...value, etag: 'internal-revision' },
      revision: 2,
      status: 'confirmed',
      origin: 'owner',
    });

  await startImport(uid, {
    batchId,
    count: 1,
    root: hash([['same', hash(value)]]),
    settings: { ...defaults, services: [] },
  });

  await importRecords(uid, batchId, [value]);

  await expect(completeImport(uid, batchId)).resolves.toBeUndefined();
});
