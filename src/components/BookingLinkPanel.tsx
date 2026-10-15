import { useState } from 'react';
import { useAgenda } from '../hooks/useAgenda';
import { ownerRequest } from '../services/cloudAgenda';
export function BookingLinkPanel() {
  const { cloudState: state, identity, online, refresh } = useAgenda();
  const [checked, setChecked] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  if (!identity || !state) return null;
  const origin =
    import.meta.env.VITE_PUBLIC_BOOKING_ORIGIN || 'https://agenda-estetica-phi.vercel.app';
  const url = state.linkCode ? `${origin}/agendar/${state.linkCode}` : '';
  async function toggle() {
    setBusy(true);
    setMessage('');
    try {
      await ownerRequest(identity!, {
        action: 'link',
        enabled: !state!.publicEnabled,
        revision: state!.settingsRevision,
      });
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Não foi possível alterar.');
    } finally {
      setBusy(false);
    }
  }
  async function share(native = false) {
    try {
      if (native && navigator.share)
        await navigator.share({ title: state!.settings.studio, text: 'Escolha seu horário:', url });
      else {
        await navigator.clipboard.writeText(url);
        setMessage('Link copiado. Envie para suas clientes.');
      }
    } catch {
      setMessage('Não foi possível compartilhar. Selecione e copie o link abaixo.');
    }
  }
  return (
    <section className="panel settings-panel">
      <h2>Link de agendamento</h2>
      <p>Suas clientes escolhem um horário livre e recebem a confirmação automaticamente.</p>
      <p className="helper">
        {state.publicEnabled
          ? 'Recebendo agendamentos online.'
          : 'Novas reservas pelo link estão pausadas.'}
      </p>
      {url && (
        <>
          <label className="field">
            Seu link
            <input readOnly value={url} onFocus={(e) => e.target.select()} />
          </label>
          <div className="backup-actions">
            <button className="button secondary" onClick={() => void share()}>
              Copiar link
            </button>
            <button className="button secondary" onClick={() => void share(true)}>
              Compartilhar
            </button>
            <a className="text-button" href={url} target="_blank" rel="noreferrer">
              Ver página
            </a>
          </div>
        </>
      )}
      {!state.publicEnabled && (
        <label className="checkbox-line">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          Conferi os agendamentos e atualizei todos os aparelhos usados na agenda.
        </label>
      )}
      <button
        className="button"
        disabled={busy || !online || !state.migrationReady || (!state.publicEnabled && !checked)}
        onClick={() => void toggle()}
      >
        {busy
          ? 'Salvando…'
          : state.publicEnabled
            ? 'Pausar novas reservas'
            : 'Ativar link de agendamento'}
      </button>
      {!state.migrationReady && (
        <p className="helper">Conclua a conferência dos dados antes de ativar.</p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
