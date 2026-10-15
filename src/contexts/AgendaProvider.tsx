import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AgendaBackup, Appointment, AppointmentInput, LocalAgenda, Settings } from '../types';
import { AgendaContext } from './AgendaContext';
import { todayKey } from '../utils/dates';
import { defaults } from '../data/defaults';
import { legacyRepository, type AgendaRepository } from '../services/localAgenda';
import { validateBackupSettings } from '../services/backup';
import { useOnline } from '../hooks/useOnline';
const message = (e: unknown) =>
  e instanceof Error ? e.message : 'Não foi possível concluir a operação.';
export function AgendaProvider({
  children,
  repository = legacyRepository,
}: {
  children: ReactNode;
  repository?: AgendaRepository;
}) {
  const [state, setState] = useState<LocalAgenda>(() => ({
    appointments: [],
    settings: structuredClone(defaults),
    updatedAt: '',
  }));
  const [selected, setSelected] = useState(todayKey);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const online = useOnline();
  const lock = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (lock.current) return;
    const started = generation.current;
    try {
      const saved = await repository.read();
      if (started !== generation.current) return;
      setState(saved);
      setReady(true);
      setError('');
    } catch (e) {
      if (started !== generation.current) return;
      setError(message(e));
      setReady(false);
    }
  }, [repository]);
  useEffect(() => {
    const currentGeneration = generation.current;
    void refresh();
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel(repository.channelName);
      channel.current.onmessage = () => void refresh();
    }
    const focus = () => void refresh();
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visible);
    return () => {
      generation.current = currentGeneration + 1;
      channel.current?.close();
      channel.current = null;
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh, repository]);
  async function mutate(action: () => Promise<LocalAgenda>, success: string) {
    if (!ready)
      throw new Error(
        'O armazenamento ainda não está disponível. Aguarde ou tente carregar novamente.',
      );
    if (lock.current) throw new Error('Aguarde a gravação terminar.');
    lock.current = true;
    setLoading(true);
    const started = generation.current;
    try {
      const saved = await action();
      if (started !== generation.current) return;
      setState(saved);
      setError('');
      setNotice(success);
      channel.current?.postMessage('changed');
    } finally {
      lock.current = false;
      if (started === generation.current) setLoading(false);
    }
  }
  async function save(input: AppointmentInput, existing?: Appointment, id?: string) {
    await mutate(
      () => repository.save(input, existing, id),
      existing ? 'Agendamento atualizado neste aparelho.' : 'Agendamento salvo neste aparelho.',
    );
    setSelected(input.data);
  }
  async function saveSettings(settings: Settings) {
    await mutate(
      () => repository.saveSettings(validateBackupSettings(settings)),
      'Configurações salvas neste aparelho.',
    );
  }
  async function restore(backup: AgendaBackup, expected: LocalAgenda) {
    await mutate(() => repository.restore(backup, expected), 'Backup restaurado neste aparelho.');
  }
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  return (
    <AgendaContext.Provider
      value={{
        appointments: state.appointments,
        busy: [],
        syncedAt: state.updatedAt,
        settings: state.settings,
        selected,
        setSelected,
        ready,
        online,
        loading,
        error,
        notice,
        clearNotice: () => setNotice(''),
        refresh,
        save,
        saveSettings,
        remove: (a) => mutate(() => repository.remove(a), 'Agendamento cancelado neste aparelho.'),
        backup: repository.read,
        restore,
      }}
    >
      {children}
    </AgendaContext.Provider>
  );
}
