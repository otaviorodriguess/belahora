import { it, expect } from 'vitest';
import { adminDb } from '../../server/firebaseAdmin';
import { defaults } from '../../src/data/defaults';
import { getPublicCatalog, getPublicSlots, confirmPublicBooking } from '../../server/publicBooking';
import { formatInTimeZone } from 'date-fns-tz';
it('confirma sem expor cliente e calcula preço no servidor', async () => {
  const uid = `public-${crypto.randomUUID()}`,
    code = crypto.randomUUID(),
    date = formatInTimeZone(Date.now() + 86400000, 'America/Sao_Paulo', 'yyyy-MM-dd');
  await adminDb()
    .doc(`accounts/${uid}`)
    .set({
      settings: {
        ...defaults,
        studio: 'Teste',
        hours: Array.from({ length: 7 }, () => ({ active: true, start: '08:00', end: '20:00' })),
        services: [{ id: 's', nome: 'Limpeza', preco: 120, duracao: 60 }],
      },
      migrationReady: true,
      settingsRevision: 1,
      publicEnabled: true,
      linkCode: code,
    });
  await adminDb().doc(`bookingLinks/${code}`).set({ uid });
  const slots = await getPublicSlots(code, 's', date);
  expect(slots.length).toBeGreaterThan(0);
  const input = {
    code,
    serviceId: 's',
    date,
    start: slots[0],
    name: 'Privada',
    phone: '11999999999',
    operationId: crypto.randomUUID(),
  };
  const receipt = await confirmPublicBooking(input);
  expect(receipt.price).toBe(120);
  expect(JSON.stringify(receipt)).not.toContain('Privada');
  expect(JSON.stringify(await getPublicCatalog(code))).not.toContain('11999999999');
  expect(await confirmPublicBooking(input)).toEqual(receipt);
  await adminDb().doc(`accounts/${uid}`).update({ publicEnabled: false, migrationReady: false });
  expect(await confirmPublicBooking(input)).toEqual(receipt);
  await expect(
    confirmPublicBooking({ ...input, operationId: crypto.randomUUID() }),
  ).rejects.toThrow();
});
