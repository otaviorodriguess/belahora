import { it, expect } from 'vitest';
import { adminDb } from '../../server/firebaseAdmin';
import { mutateAppointment, updateSettings } from '../../server/agendaService';
import { consumeRateLimit } from '../../server/access';
import { defaults } from '../../src/data/defaults';
const input = {
  nomeCliente: 'Teste',
  telefone: '11999999999',
  servico: 's',
  valor: 10,
  data: '2026-10-12',
  horaInicio: '10:00',
  horaFim: '11:00',
  duracao: 60,
  observacoes: '',
};
async function setup() {
  const uid = crypto.randomUUID();
  await adminDb()
    .doc(`accounts/${uid}`)
    .set({
      settings: { ...defaults, services: [] },
      settingsRevision: 1,
      migrationReady: true,
      publicEnabled: false,
      linkCode: null,
    });
  return uid;
}
it('reagenda entre dias, rejeita revisão antiga e cancela sem ressuscitar no retry', async () => {
  const uid = await setup(),
    create = { kind: 'create' as const, input, operationId: crypto.randomUUID() },
    a = await mutateAppointment(uid, create);
  const moved = await mutateAppointment(uid, {
    kind: 'update',
    id: a.value.id,
    expectedRevision: 1,
    input: { ...input, data: '2026-10-13' },
    operationId: crypto.randomUUID(),
  });
  expect(moved.revision).toBe(2);
  expect((await adminDb().doc(`accounts/${uid}/days/2026-10-12`).get()).data()?.occupancy).toEqual(
    [],
  );
  await expect(
    mutateAppointment(uid, {
      kind: 'cancel',
      id: a.value.id,
      expectedRevision: 1,
      operationId: crypto.randomUUID(),
    }),
  ).rejects.toThrow();
  await mutateAppointment(uid, {
    kind: 'cancel',
    id: a.value.id,
    expectedRevision: 2,
    operationId: crypto.randomUUID(),
  });
  await mutateAppointment(uid, create);
  expect(
    (await adminDb().doc(`accounts/${uid}/appointments/${a.value.id}`).get()).data()?.status,
  ).toBe('cancelled');
});
it('não substitui configurações alteradas por outro aparelho', async () => {
  const uid = await setup();
  await updateSettings(uid, { ...defaults, services: [], studio: 'Nova' }, 1, crypto.randomUUID());
  await expect(
    updateSettings(uid, { ...defaults, services: [], studio: 'Antiga' }, 1, crypto.randomUUID()),
  ).rejects.toThrow();
});
it('limites persistentes resistem a requisições concorrentes', async () => {
  const originHash = crypto.randomUUID(),
    code = crypto.randomUUID();
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, () =>
      consumeRateLimit({ kind: 'write', originHash, code, nowMs: 1000 }),
    ),
  );
  expect(results.filter((r) => r.status === 'fulfilled').length).toBeLessThanOrEqual(10);
});
