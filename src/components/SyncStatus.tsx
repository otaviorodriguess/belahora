import { Smartphone, CircleCheck, LoaderCircle } from 'lucide-react';
import { useAgenda } from '../hooks/useAgenda';
export function SyncStatus() {
  const { online, ready, loading, error, refresh, notice, clearNotice, storageMode, canWrite, readOnly } =
    useAgenda();
  if (readOnly) return <div className="status-banner" role="status">Demonstração · Somente leitura · Todos os dados são fictícios.</div>;
  return (
    <>
      {(!ready || loading || !online || (storageMode === 'cloud' && !canWrite)) && (
        <div className={`status-banner ${!online ? 'offline' : ''}`} role="status">
          {!ready ? (
            <>
              <LoaderCircle size={16} className="spin" />
              <span>{error ? 'Armazenamento indisponível' : 'Carregando sua agenda…'}</span>
            </>
          ) : loading ? (
            <>
              <LoaderCircle size={16} className="spin" />
              <span>
                {storageMode === 'cloud' ? 'Confirmando na nuvem…' : 'Salvando neste aparelho…'}
              </span>
            </>
          ) : (
            <>
              <Smartphone size={16} />
              <span>
                {storageMode === 'cloud'
                  ? online
                    ? 'Conferindo a migração da agenda · Consulte as configurações'
                    : 'Sem internet · Consulta disponível; alterações precisam de conexão'
                  : online
                    ? 'Agenda salva neste aparelho · Sem mensalidade'
                    : 'Sem internet · Seus agendamentos continuam sendo salvos neste aparelho.'}
              </span>
            </>
          )}
        </div>
      )}
      {error && (
        <div className="error-message global-error" role="alert">
          {error}
          <button className="text-button" onClick={() => void refresh()}>
            Carregar novamente
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <CircleCheck size={19} />
          <span>{notice}</span>
          <button aria-label="Fechar aviso" onClick={clearNotice}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
