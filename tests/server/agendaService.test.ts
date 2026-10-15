import { beforeAll, it, expect } from 'vitest';
import { adminDb } from '../../server/firebaseAdmin';
import { mutateAppointment } from '../../server/agendaService';
import { defaults } from '../../src/data/defaults';
beforeAll(() => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')
    throw new Error('Emulator required');
});
const input = {
  nomeCliente: 'Teste',
  telefone: '11999999999',
  servico: 's',
  valor: 100,
  data: '2026-10-12',
  horaInicio: '10:00',
  horaFim: '11:00',
  duracao: 60,
  observacoes: '',
};
it('somente uma reserva vence e retry não duplica', async () => {
  const uid = `test-${crypto.randomUUID()}`;
  await adminDb()
    .doc(`accounts/${uid}`)
    .set({
      settings: defaults,
      settingsRevision: 1,
      migrationReady: true,
      publicEnabled: false,
      linkCode: null,
    });
  const commands = Array.from({ length: 20 }, () => ({
    kind: 'create' as const,
    input,
    operationId: crypto.randomUUID(),
  }));
  const results = await Promise.allSettled(commands.map((c) => mutateAppointment(uid, c)));
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const win = results.findIndex((r) => r.status === 'fulfilled');
  const again = await mutateAppointment(uid, commands[win]);
  expect(again).toEqual((results[win] as PromiseFulfilledResult<unknown>).value);
  await expect(
    mutateAppointment(uid, { ...commands[win], input: { ...input, nomeCliente: 'Outro' } }),
  ).rejects.toThrow();
});
