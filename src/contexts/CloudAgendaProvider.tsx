import { useEffect, useRef, useState, type ReactNode } from 'react';

import { AgendaContext } from './AgendaContext';

import type { AuthIdentity } from '../services/firebaseAuth';

import type { LocalAgenda, Appointment, AppointmentInput, Settings } from '../types';

import type { CloudState, Command } from '../../shared/booking';

import { defaults } from '../data/defaults';

import { createAgendaRepository } from '../services/localAgenda';

import { loadCloud, ownerRequest, scopeKey, subscribeCloud } from '../services/cloudAgenda';

import { readCache, writeCache } from '../services/cloudCache';

import { migrateAgenda, resumeMigration } from '../services/agendaMigration';

import { todayKey } from '../utils/dates';

import { useOnline } from '../hooks/useOnline';

export function CloudAgendaProvider({
  identity,

  children,
}: {
  identity: AuthIdentity;

  children: ReactNode;
}) {
  const [state, setState] = useState<CloudState | null>(null),
    [local, setLocal] = useState<LocalAgenda | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [loading, setLoading] = useState(false),
    [selected, setSelected] = useState(todayKey),
    [attempt, setAttempt] = useState(0),
    [confirmed, setConfirmed] = useState(false);

  const online = useOnline(),
    alive = useRef(false),
    busy = useRef(false);

  const key = scopeKey(identity);

  useEffect(() => {
    let active = true;

    alive.current = true;

    let unsubscribe = () => {};

    const accept = (value: CloudState) => {
      if (!active) return;

      setState(value);

      setConfirmed(true);

      void writeCache(`${key}:state`, value).catch(() => {
        if (active)
          setError('A agenda está na nuvem, mas o cache offline não pôde ser atualizado.');
      });
    };

    async function boot() {
      try {
        const cache = await readCache<CloudState>(`${key}:state`);

        if (active && cache) setState(cache);

        // Resolve demo access before opening or claiming any local legacy agenda.
        if (!navigator.onLine && cache?.readOnly) return;
        const initialRemote = navigator.onLine ? await loadCloud(identity) : null;
        if (!active) return;
        if (initialRemote?.readOnly) {
          accept(initialRemote);
          const first = initialRemote.appointments.find((a) => a.status === 'confirmed');
          if (first) setSelected(first.value.data);
          unsubscribe = subscribeCloud(identity, accept, (e) => {
            if (active) setError(e.message);
          });
          return;
        }

        const repository = createAgendaRepository({
          kind: 'account',

          projectId: identity.projectId,

          uid: identity.uid,
        });

        if ((await repository.legacyStatus()) === 'available' && active) {
          try {
            await repository.claimLegacy();
          } catch {
            if ((await repository.legacyStatus()) === 'available')
              throw new Error('Não foi possível preservar a agenda anterior.');
          }
        }

        const snapshot = await repository.read();

        if (!active) return;

        if (snapshot.appointments.length) setLocal(snapshot);

        if (!navigator.onLine) {
          setConfirmed(false);

          if (!cache && !snapshot.appointments.length)
            setError('Conecte à internet para carregar sua agenda neste aparelho.');

          return;
        }

        let remote = initialRemote;

        if (!active) return;

        if (remote) accept(remote);

        try {
          if (remote?.activeBatch)
            await resumeMigration(identity, remote.activeBatch, () => active);
          else if (
            !remote ||
            snapshot.appointments.length ||
            snapshot.settings.services === undefined ||
            snapshot.settings.services.length > 0
          )
            await migrateAgenda(identity, snapshot, () => active);
        } catch (e) {
          if (active) setError(e instanceof Error ? e.message : 'Importação pendente.');
        }

        if (!active) return;

        remote = await loadCloud(identity);

        if (remote) accept(remote);

        unsubscribe = subscribeCloud(identity, accept, (e) => {
          if (active) {
            setConfirmed(false);

            setError(e.message);
          }
        });
      } catch (e) {
        if (active) {
          setConfirmed(false);

          setError(e instanceof Error ? e.message : 'Não foi possível carregar.');
        }
      }
    }

    void boot();

    return () => {
      active = false;

      alive.current = false;

      unsubscribe();
    };

    // Identity is immutable for this keyed provider.

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, online]);

  const snapshot: LocalAgenda = state
    ? {
        appointments: state.appointments

          .filter((a) => a.status === 'confirmed')

          .map((a) => ({ ...a.value, etag: String(a.revision) })),

        settings: state.settings,

        updatedAt: new Date().toISOString(),
      }
    : local || { appointments: [], settings: defaults, updatedAt: '' };

  const canWrite = !state?.readOnly && online && confirmed && state?.migrationReady === true;

  async function run(operation: () => Promise<unknown>, importing = false) {
    if (state?.readOnly) throw new Error('Conta de demonstração: somente leitura.');
    if (!(importing ? online && confirmed && !!state : canWrite))
      throw new Error('Conecte à internet e conclua a migração nas configurações.');

    if (busy.current) throw new Error('Aguarde a gravação terminar.');

    busy.current = true;

    setLoading(true);

    try {
      await operation();

      if (!alive.current) return;

      const next = await loadCloud(identity);

      if (next && alive.current) {
        setState(next);

        setNotice('Alteração confirmada na nuvem.');

        setError('');
      }
    } finally {
      busy.current = false;

      if (alive.current) setLoading(false);
    }
  }

  const mutate = (command: Command) =>
    run(() => ownerRequest(identity, { action: 'mutate', command }));

  const revision = (a: Appointment) => Number(a.etag);

  async function save(input: AppointmentInput, existing?: Appointment, operationId?: string) {
    await mutate(
      existing
        ? {
            kind: 'update',

            id: existing.id,

            input,

            expectedRevision: revision(existing),

            operationId: operationId || crypto.randomUUID(),
          }
        : { kind: 'create', input, operationId: operationId || crypto.randomUUID() },
    );

    setSelected(input.data);
  }

  async function saveSettings(settings: Settings, expectedRevision = state!.settingsRevision) {
    await run(() =>
      ownerRequest(identity, {
        action: 'settings',

        settings,

        revision: expectedRevision,

        operationId: crypto.randomUUID(),
      }),
    );
  }

  return (
    <AgendaContext.Provider
      value={{
        ...snapshot,

        busy: [],

        syncedAt: snapshot.updatedAt,

        online,

        ready: !!state || !!local,

        loading,

        error,

        notice,

        selected,

        setSelected,

        save,

        saveSettings,

        remove: (a) =>
          mutate({
            kind: 'cancel',

            id: a.id,

            expectedRevision: revision(a),

            operationId: crypto.randomUUID(),
          }),

        refresh: async () => {
          setError('');

          setAttempt((n) => n + 1);
        },

        clearNotice: () => setNotice(''),

        backup: async () => snapshot,

        restore: async (backup) => {
          await run(() => migrateAgenda(identity, backup, () => alive.current, true), true);
        },

        storageMode: 'cloud',

        canWrite,

        readOnly: state?.readOnly === true,

        cloudState: state,

        identity,
      }}
    >
      {children}
    </AgendaContext.Provider>
  );
}
