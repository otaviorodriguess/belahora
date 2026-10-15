import { useState } from 'react';
import type { AgendaRepository } from '../services/localAgenda';
import { downloadBackup } from '../services/backup';
import type { LocalAgenda } from '../types';
import { useOperationLifetime } from '../hooks/useOperationLifetime';
export function LegacyAgendaPrompt({
  repository,
  email,
  onDone,
  onSkip,
}: {
  repository: AgendaRepository;
  email: string;
  onDone: (saved: LocalAgenda) => void;
  onSkip: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const beginOperation = useOperationLifetime();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function action(claim: boolean) {
    const isCurrent = beginOperation();
    setBusy(true);
    setError('');
    try {
      if (claim) {
        const saved = await repository.claimLegacy();
        if (!isCurrent()) return;
        onDone(saved);
      } else {
        const saved = await repository.readLegacyForBackup();
        if (!isCurrent()) return;
        downloadBackup(saved);
        setNotice('Backup exportado. Guarde o arquivo antes de continuar.');
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível acessar a agenda anterior.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel auth-card">
      <span className="eyebrow">SUA AGENDA CONTINUA AQUI</span>
      <h1>Encontramos uma agenda neste aparelho</h1>
      <p>
        Deseja vincular os agendamentos e as configurações anteriores à conta{' '}
        <strong>{email}</strong>?
      </p>
      <p className="muted">
        Confira a conta antes de continuar. A vinculação só pode ser feita uma vez e mantém uma
        cópia da agenda original neste aparelho.
      </p>
      <button className="button secondary" disabled={busy} onClick={() => void action(false)}>
        Exportar agenda anterior
      </button>
      <button className="button" disabled={busy} onClick={() => void action(true)}>
        Vincular agenda a esta conta
      </button>
      <button className="text-button" disabled={busy} onClick={onSkip}>
        Começar com agenda vazia
      </button>
      <p className="helper">
        A agenda anterior será preservada. Você poderá vinculá-la depois, nas configurações,
        enquanto esta conta estiver vazia.
      </p>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="saved-message">
          {notice}
        </p>
      )}
    </section>
  );
}
