import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Download, Upload, HardDrive, ShieldCheck } from 'lucide-react';
import type { AgendaBackup, LocalAgenda, Settings } from '../types';
import { useOperationLifetime } from '../hooks/useOperationLifetime';
import { useAgenda } from '../hooks/useAgenda';
import { MAX_BACKUP_BYTES, downloadBackup, parseBackup } from '../services/backup';
import { requestPersistence } from '../services/localAgenda';
import { Modal } from './Modal';
export function BackupPanel({ onRestored }: { onRestored: (settings: Settings) => void }) {
  const { backup, restore, ready, loading, appointments, storageMode } = useAgenda();
  const [pending, setPending] = useState<AgendaBackup | null>(null);
  const [expectedRestore, setExpectedRestore] = useState<LocalAgenda | null>(null);
  const beginOperation = useOperationLifetime();
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [working, setWorking] = useState(false);
  const [persistent, setPersistent] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void navigator.storage
      ?.persisted?.()
      .then(setPersistent)
      .catch(() => {});
  }, []);
  async function exportFile() {
    const isCurrent = beginOperation();
    setWorking(true);
    setError('');
    try {
      const saved = await backup();
      if (!isCurrent()) return;
      downloadBackup(saved);
      setFeedback('Backup gerado. Guarde o arquivo baixado em um local seguro.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível exportar o backup.');
    } finally {
      setWorking(false);
    }
  }
  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const isCurrent = beginOperation();
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setFeedback('');
    setWorking(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('O backup deve ter até 10 MB.');
      const parsed = parseBackup(await file.text());
      const expected = await backup();
      if (!isCurrent()) return;
      setExpectedRestore(expected);
      setPending(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível ler o backup.');
    } finally {
      setWorking(false);
    }
  }
  async function confirmRestore() {
    if (!pending || !expectedRestore) return;
    const isCurrent = beginOperation();
    setWorking(true);
    setError('');
    try {
      await restore(pending, expectedRestore);
      if (!isCurrent()) return;
      if (storageMode !== 'cloud') onRestored(pending.settings);
      setPending(null);
      setFeedback('Backup restaurado. Seus atendimentos estão disponíveis na agenda.');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Não foi possível restaurar. Seus dados anteriores foram mantidos.',
      );
    } finally {
      setWorking(false);
    }
  }
  async function protect() {
    setWorking(true);
    const granted = await requestPersistence();
    setPersistent(granted);
    setFeedback(
      granted
        ? 'O navegador concedeu proteção contra limpeza automática. Continue fazendo backups.'
        : 'O navegador não concedeu proteção adicional. A agenda continua salva; mantenha seus backups.',
    );
    setWorking(false);
  }
  return (
    <section className="panel settings-panel backup-panel">
      <div className="integration-icon">
        <HardDrive size={23} />
      </div>
      <h2>{storageMode === 'cloud' ? 'Cópia de segurança' : 'Seus dados no aparelho'}</h2>
      <p className="muted small">
        {storageMode === 'cloud'
          ? 'Dados confirmados na nuvem'
          : 'Agenda salva neste aparelho · Sem mensalidade'}
      </p>
      <p className="muted small">
        {storageMode === 'cloud'
          ? 'Exporte uma cópia dos seus agendamentos quando precisar.'
          : 'Seus agendamentos são salvos no armazenamento local deste aparelho.'}
      </p>
      <p className="backup-count">
        {appointments.length}{' '}
        {appointments.length === 1 ? 'agendamento salvo' : 'agendamentos salvos'}
      </p>
      <div className="backup-actions">
        <button
          className="button"
          disabled={!ready || loading || working}
          onClick={() => void exportFile()}
        >
          <Download size={17} />
          Exportar backup
        </button>
        <button
          className="button secondary"
          disabled={!ready || loading || working}
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={17} />
          Importar backup
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        aria-label="Selecionar arquivo de backup"
        hidden
        onChange={(event) => void selectFile(event)}
      />
      <button
        className="text-button"
        disabled={persistent || working || !ready}
        onClick={() => void protect()}
      >
        <ShieldCheck size={17} />
        {persistent ? 'Proteção adicional ativada' : 'Proteger armazenamento'}
      </button>
      <p className="integration-note">
        {storageMode === 'cloud'
          ? 'Em outro aparelho, entre na mesma conta para consultar os dados confirmados na nuvem. A cópia local antiga continua preservada neste aparelho.'
          : 'Os dados ficam neste aparelho e navegador. Exporte backups regularmente; para trocar de celular, importe o arquivo no novo aparelho.'}
      </p>
      {feedback && (
        <p className="saved-message" role="status">
          {feedback}
        </p>
      )}
      {error && !pending && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <Modal title="Restaurar backup?" onClose={() => setPending(null)} locked={working}>
          <p className="confirm-copy">
            Arquivo de {new Date(pending.exportedAt).toLocaleString('pt-BR')}, com{' '}
            <strong>{pending.appointments.length} agendamentos</strong>.
          </p>
          <p className="form-note">
            {storageMode === 'cloud'
              ? 'Os registros serão importados sem apagar a agenda atual. Diferenças ficarão para conferência e novas reservas serão pausadas durante a importação.'
              : `A restauração substituirá os ${appointments.length} agendamentos e as configurações deste aparelho pelo conteúdo do arquivo. Exporte a agenda atual antes de continuar.`}
          </p>
          <button className="button secondary" disabled={working} onClick={() => void exportFile()}>
            <Download size={16} />
            Exportar agenda atual
          </button>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={working}
              onClick={() => setPending(null)}
            >
              Voltar
            </button>
            <button className="button" disabled={working} onClick={() => void confirmRestore()}>
              {working
                ? 'Importando…'
                : storageMode === 'cloud'
                  ? 'Importar e conferir'
                  : 'Restaurar e substituir'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
