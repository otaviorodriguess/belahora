import type { Appointment, AppointmentInput, LocalAgenda, Settings } from '../types';
import { readSettings } from './localSettings';
import { readSnapshot } from './offlineCache';
import { validateAppointment } from '../utils/validation';
import { defaults } from '../data/defaults';
import { agendaKey, type AgendaScope } from './agendaIdentity';
const DB_NAME = 'aura-local-agenda';
const STORE = 'agenda';
let opening: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () =>
      reject(
        new Error(
          'Não foi possível acessar a agenda neste navegador. Permita o armazenamento de dados e tente novamente.',
        ),
      );
    request.onblocked = () =>
      reject(new Error('Feche outras abas da Bela Hora e tente novamente.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        opening = undefined;
      };
      resolve(db);
    };
  }).catch((error) => {
    opening = undefined;
    throw error;
  });
  return opening;
}
export function createAgendaRepository(scope: AgendaScope) {
  const KEY = agendaKey(scope);
  const isLegacy = scope.kind === 'legacy';
  // Scope is captured once; switching accounts cannot redirect a pending transaction.
  async function transaction(
    update?: (current: LocalAgenda | undefined) => LocalAgenda,
  ): Promise<LocalAgenda | undefined> {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, update ? 'readwrite' : 'readonly');
      const store = tx.objectStore(STORE);
      let result: LocalAgenda | undefined;
      let cause: unknown;
      const request = store.get(KEY);
      request.onsuccess = () => {
        try {
          result = update
            ? update(request.result as LocalAgenda | undefined)
            : (request.result as LocalAgenda | undefined);
          if (update) store.put(result, KEY);
        } catch (error) {
          cause = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () =>
        reject(
          cause ||
            new Error(
              'Não foi possível salvar. Verifique o espaço disponível e as permissões do navegador. Seus dados anteriores foram mantidos.',
            ),
        );
      tx.onerror = () => {
        /* onabort reports the final failure. */
      };
    });
  }
  async function readLocalAgenda(): Promise<LocalAgenda> {
    const existing = await transaction();
    if (existing) {
      if (existing.hoursExtendedTo20) return existing;
      return (await transaction((current) => {
        if (!current || current.hoursExtendedTo20) return current!;
        return {
          ...current,
          hoursExtendedTo20: true,
          settings: {
            ...current.settings,
            hours: current.settings.hours.map((day) =>
              day.active && day.end < '20:00' ? { ...day, end: '20:00' } : day,
            ),
          },
        };
      }))!;
    }
    const settings = isLegacy ? readSettings() : { ...structuredClone(defaults), services: [] };
    // Preserve real appointments from an older installation, never demo appointments.
    const previous = settings.cachedCalendarId
      ? await readSnapshot(settings.cachedCalendarId)
      : null;
    const initial: LocalAgenda = {
      hoursExtendedTo20: true,
      appointments: (previous?.appointments || []).map((a) => ({
        ...a,
        googleEventId: undefined,
        etag: crypto.randomUUID(),
      })),
      settings: {
        ...settings,
        hours: settings.hours.map((day) =>
          day.active && day.end < '20:00' ? { ...day, end: '20:00' } : day,
        ),
        mode: 'local',
        cachedCalendarId: undefined,
      },
      updatedAt: new Date().toISOString(),
    };
    return (await transaction((current) => current || initial))!;
  }
  async function updateLocalAgenda(
    update: (current: LocalAgenda) => LocalAgenda,
  ): Promise<LocalAgenda> {
    return (await transaction((current) => {
      if (!current) throw new Error('A agenda ainda está carregando. Tente novamente.');
      return update(current);
    }))!;
  }
  async function saveLocalAppointment(
    input: AppointmentInput,
    existing?: Appointment,
    id?: string,
  ) {
    return updateLocalAgenda((current) => {
      if (existing) {
        const stored = current.appointments.find((a) => a.id === existing.id);
        if (!stored || (stored.etag || stored.updatedAt) !== (existing.etag || existing.updatedAt))
          throw new Error(
            'Este atendimento foi alterado em outra aba. Feche os detalhes e abra novamente.',
          );
      }
      const invalid = validateAppointment(
        input,
        current.settings,
        current.appointments,
        [],
        existing?.id,
      );
      if (invalid) throw new Error(invalid);
      const now = new Date().toISOString();
      const appointment: Appointment = {
        ...input,
        id: existing?.id || id || crypto.randomUUID(),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        etag: crypto.randomUUID(),
      };
      return {
        ...current,
        appointments: [...current.appointments.filter((a) => a.id !== appointment.id), appointment],
        updatedAt: now,
      };
    });
  }
  async function removeLocalAppointment(appointment: Appointment) {
    return updateLocalAgenda((current) => {
      const stored = current.appointments.find((a) => a.id === appointment.id);
      if (
        !stored ||
        (stored.etag || stored.updatedAt) !== (appointment.etag || appointment.updatedAt)
      )
        throw new Error(
          'Este atendimento foi alterado em outra aba. Feche os detalhes e abra novamente.',
        );
      return {
        ...current,
        appointments: current.appointments.filter((a) => a.id !== appointment.id),
        updatedAt: new Date().toISOString(),
      };
    });
  }
  function saveLocalSettings(settings: Settings) {
    return updateLocalAgenda((current) => ({
      ...current,
      settings: { ...settings, mode: 'local', cachedCalendarId: undefined },
      updatedAt: new Date().toISOString(),
    }));
  }
  type LegacyStatus = 'available' | 'claimed' | 'absent' | 'target-not-empty';
  async function legacyOperation(
    mode: 'status' | 'claim' | 'backup',
  ): Promise<LegacyStatus | LocalAgenda> {
    if (isLegacy) throw new Error('Entre em uma conta para vincular a agenda.');
    // Older versions saved real Google snapshots before IndexedDB was introduced.
    // Materialize that legacy record independently; account defaults stay isolated.
    let hasLegacySettings = false;
    try {
      hasLegacySettings = !!localStorage.getItem('aura.settings.v1');
    } catch {
      /* Storage may be unavailable. */
    }
    if (hasLegacySettings) await legacyRepository.read();
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode === 'claim' ? 'readwrite' : 'readonly');
      const store = tx.objectStore(STORE);
      const original = store.get('current');
      const owner = store.get('legacy-owner');
      const target = store.get(KEY);
      let result: LegacyStatus | LocalAgenda;
      let cause: unknown;
      target.onsuccess = () => {
        try {
          const legacy = original.result as LocalAgenda | undefined;
          const destination = target.result as LocalAgenda | undefined;
          const status: LegacyStatus = !legacy
            ? 'absent'
            : owner.result
              ? 'claimed'
              : destination?.appointments.length
                ? 'target-not-empty'
                : 'available';
          if (mode === 'status') {
            result = status;
            return;
          }
          if (mode === 'backup' && legacy && (!owner.result || owner.result === KEY)) {
            result = legacy;
            return;
          }
          if (mode !== 'claim' || status !== 'available' || !legacy)
            throw new Error(
              'Esta agenda não pode ser vinculada. Ela já foi vinculada ou a conta atual possui agendamentos.',
            );
          store.put(legacy, KEY);
          store.put(KEY, 'legacy-owner');
          result = legacy;
        } catch (error) {
          cause = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () =>
        reject(
          cause || new Error('Não foi possível vincular. Seus dados anteriores foram mantidos.'),
        );
      tx.onerror = () => {};
    });
  }
  return {
    channelName: `aura-local-changes:${KEY}`,
    read: readLocalAgenda,
    update: updateLocalAgenda,
    save: saveLocalAppointment,
    remove: removeLocalAppointment,
    saveSettings: saveLocalSettings,
    restore: (replacement: LocalAgenda, expected: LocalAgenda) =>
      updateLocalAgenda((current) => {
        if (JSON.stringify(current) !== JSON.stringify(expected))
          throw new Error(
            'A agenda mudou desde a confirmação. Feche a restauração e selecione o backup novamente.',
          );
        return {
          hoursExtendedTo20: true,
          settings: replacement.settings,
          appointments: replacement.appointments.map((a) => ({ ...a, etag: crypto.randomUUID() })),
          updatedAt: new Date().toISOString(),
        };
      }),
    legacyStatus: () => legacyOperation('status') as Promise<LegacyStatus>,
    claimLegacy: () => legacyOperation('claim') as Promise<LocalAgenda>,
    readLegacyForBackup: () => legacyOperation('backup') as Promise<LocalAgenda>,
  };
}
export type AgendaRepository = ReturnType<typeof createAgendaRepository>;
export const legacyRepository = createAgendaRepository({ kind: 'legacy' });
export const readLocalAgenda = legacyRepository.read;
export const updateLocalAgenda = legacyRepository.update;
export const saveLocalAppointment = legacyRepository.save;
export const removeLocalAppointment = legacyRepository.remove;
export const saveLocalSettings = legacyRepository.saveSettings;
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) || false;
  } catch {
    return false;
  }
}
