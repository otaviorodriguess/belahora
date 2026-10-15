import type { LocalAgenda } from '../types';

import type { AuthIdentity } from './firebaseAuth';

import { canonical } from '../../shared/booking';

import { services } from '../data/services';

import { ownerRequest, scopeKey } from './cloudAgenda';

import { preserveSnapshot, readCache, writeCache } from './cloudCache';

async function digest(value: unknown) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value))),
    ),
  )

    .map((b) => b.toString(16).padStart(2, '0'))

    .join('');
}

export async function prepareMigration(identity: AuthIdentity, snapshot: LocalAgenda) {
  const items = await Promise.all(snapshot.appointments.map(async (a) => [a.id, await digest(a)]));

  items.sort(([a], [b]) => a.localeCompare(b));

  if (new Set(items.map(([id]) => id)).size !== items.length)
    throw new Error('Há identificadores duplicados no backup. A cópia foi preservada.');

  const root = await digest(items),
    settings = { ...snapshot.settings, services: snapshot.settings.services ?? services },
    batchId = await digest({ root, settings });

  await preserveSnapshot(`${scopeKey(identity)}:backup:${batchId}`, snapshot);

  return { batchId, count: items.length, root, settings };
}

export async function migrateAgenda(
  identity: AuthIdentity,

  snapshot: LocalAgenda,

  isActive: () => boolean,

  force = false,
) {
  const manifest = await prepareMigration(identity, snapshot),
    key = `${scopeKey(identity)}:import:${manifest.batchId}`;

  if (!force && (await readCache(key))) return;

  const check = () => {
    if (!isActive()) throw new Error('A conta mudou.');
  };

  check();

  const { complete } = await ownerRequest<{ complete: boolean }>(identity, {
    action: 'import-start',

    manifest,
  });

  if (!complete) {
    for (let i = 0; i < snapshot.appointments.length; i += 50) {
      check();

      await ownerRequest(identity, {
        action: 'import-records',

        batchId: manifest.batchId,

        records: snapshot.appointments.slice(i, i + 50),
      });
    }

    check();

    await ownerRequest(identity, { action: 'import-complete', batchId: manifest.batchId });
  }

  check();

  await writeCache(key, true);
}

export async function resumeMigration(
  identity: AuthIdentity,
  batchId: string,
  isActive: () => boolean,
) {
  const snapshot = await readCache<LocalAgenda>(`${scopeKey(identity)}:backup:${batchId}`);

  if (!snapshot)
    throw new Error(
      'Retome a importação no aparelho onde ela começou ou selecione novamente o mesmo arquivo de backup.',
    );

  const manifest = await prepareMigration(identity, snapshot);

  if (manifest.batchId !== batchId)
    throw new Error('A cópia de recuperação não corresponde ao lote.');

  await migrateAgenda(identity, snapshot, isActive, true);
}
