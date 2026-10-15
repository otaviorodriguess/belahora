import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAgenda } from '../hooks/useAgenda';
import { authError, signOut } from '../services/firebaseAuth';
import { createAgendaRepository } from '../services/localAgenda';
import { LegacyAgendaPrompt } from './LegacyAgendaPrompt';
import { Modal } from './Modal';
import type { Settings } from '../types';
export function AccountPanel({ onMigrated }: { onMigrated: (settings: Settings) => void }) {
  const { state } = useAuth();
  const { loading, refresh, appointments, storageMode, readOnly } = useAgenda();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [available, setAvailable] = useState(false);
  const [show, setShow] = useState(false);
  const uid = state.status === 'signed-in' ? state.identity.uid : '';
  const projectId = state.status === 'signed-in' ? state.identity.projectId : '';
  const repository = useMemo(
    () => (uid && !readOnly ? createAgendaRepository({ kind: 'account', uid, projectId }) : null),
    [uid, projectId, readOnly],
  );
  useEffect(() => {
    let active = true;
    void repository
      ?.legacyStatus()
      .then((s) => {
        if (active) setAvailable(s === 'available');
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [repository, appointments]);
  if (state.status !== 'signed-in') return null;
  return (
    <section className="panel settings-panel">
      <h2>Sua conta</h2>
      <p className="account-email">{state.identity.email}</p>
      <p className="helper">
        {storageMode === 'cloud' ? 'Os agendamentos confirmados ficam na nuvem, nesta conta. Sair não apaga seus dados.' : 'Os agendamentos desta conta ficam somente neste aparelho. Sair não apaga seus dados.'}
      </p>
      <button
        className="button secondary"
        disabled={loading || busy}
        onClick={() => {
          setBusy(true);
          setError('');
          void signOut()
            .catch((cause) => setError(authError(cause)))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? 'Saindo…' : 'Sair da conta'}
      </button>
      {available && storageMode !== 'cloud' && (
        <button className="text-button" disabled={loading || busy} onClick={() => setShow(true)}>
          Vincular agenda anterior
        </button>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {show && repository && (
        <Modal title="Agenda anterior" onClose={() => setShow(false)}>
          <LegacyAgendaPrompt
            repository={repository}
            email={state.identity.email || 'Conta atual'}
            onSkip={() => setShow(false)}
            onDone={(saved) => {
              setShow(false);
              setAvailable(false);
              onMigrated(saved.settings);
              void refresh();
            }}
          />
        </Modal>
      )}
    </section>
  );
}
