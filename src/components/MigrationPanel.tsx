import { useEffect, useState } from 'react';
import { doc, collection, getDocFromServer, getDocsFromServer } from 'firebase/firestore';
import { useAgenda } from '../hooks/useAgenda';
import { cloudDb, ownerRequest } from '../services/cloudAgenda';
import { downloadBackup } from '../services/backup';
import type { Appointment, AppointmentInput } from '../types';
function MigrationCorrection({
  value,
  busy,
  onSave,
}: {
  value: Appointment;
  busy: boolean;
  onSave: (value: AppointmentInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<AppointmentInput>(value);
  return (
    <details>
      <summary>Corrigir e salvar como outro atendimento</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(draft);
        }}
      >
        <label className="field">
          Nome da cliente
          <input
            required
            value={draft.nomeCliente}
            onChange={(e) => setDraft({ ...draft, nomeCliente: e.target.value })}
          />
        </label>
        <label className="field">
          Data corrigida
          <input
            type="date"
            required
            value={draft.data}
            onChange={(e) => setDraft({ ...draft, data: e.target.value })}
          />
        </label>
        <label className="field">
          Horário corrigido
          <input
            type="time"
            required
            value={draft.horaInicio}
            onChange={(e) => setDraft({ ...draft, horaInicio: e.target.value })}
          />
        </label>
        <label className="field">
          Duração em minutos
          <input
            type="number"
            required
            min={5}
            max={720}
            value={draft.duracao}
            onChange={(e) => setDraft({ ...draft, duracao: e.target.valueAsNumber })}
          />
        </label>
        <button className="button" disabled={busy}>
          Salvar cópia corrigida
        </button>
      </form>
    </details>
  );
}
export function MigrationPanel() {
  const { identity, cloudState, refresh, settings, online } = useAgenda();
  const [batch, setBatch] = useState(''),
    [items, setItems] = useState<{ id: string; reason: string; value: Appointment }[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (!identity || !online) return;
    void (async () => {
      try {
        const a = doc(cloudDb(), 'accounts', identity.uid),
          data = await getDocFromServer(a),
          b = data.data()?.activeBatch;
        if (!active) return;
        setBatch(b || '');
        if (!b) {
          setItems([]);
          return;
        }
        const result = await getDocsFromServer(collection(a, 'imports', b, 'items'));
        if (active)
          setItems(
            result.docs
              .filter((d) => d.data().status === 'conflict')
              .map(
                (d) =>
                  ({ id: d.id, ...d.data() }) as { id: string; reason: string; value: Appointment },
              ),
          );
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : 'Não foi possível consultar a migração.');
      }
    })();
    return () => {
      active = false;
    };
  }, [identity, cloudState, online, attempt]);
  if (!identity || (!batch && cloudState?.migrationReady)) return null;
  async function resolve(itemId?: string, corrected?: AppointmentInput) {
    setBusy(true);
    setError('');
    try {
      if (itemId)
        await ownerRequest(identity!, {
          action: 'import-resolve',
          batchId: batch,
          itemId,
          corrected,
        });
      else await ownerRequest(identity!, { action: 'import-complete', batchId: batch });
      setAttempt((n) => n + 1);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-panel">
      <h2>Conferência da agenda</h2>
      <p>
        A cópia deste aparelho foi preservada. Resolva diferenças antes de liberar novas reservas.
      </p>
      {items.map((item) => (
        <div className="migration-item" key={item.id}>
          <strong>{item.value.nomeCliente || 'Registro antigo'}</strong>
          <p>
            {item.value.data} · {item.value.horaInicio}
          </p>
          <p className="helper">{item.reason}</p>
          <button
            className="text-button"
            onClick={() =>
              downloadBackup({
                settings,
                appointments: [item.value],
                updatedAt: new Date().toISOString(),
              })
            }
          >
            Baixar cópia deste registro
          </button>
          <button
            className="button secondary"
            disabled={busy || !online}
            onClick={() => {
              if (
                window.confirm(
                  'Manter os dados da nuvem? A cópia antiga continuará preservada para recuperação.',
                )
              )
                void resolve(item.id);
            }}
          >
            Manter nuvem e guardar cópia
          </button>
          <MigrationCorrection
            value={item.value}
            busy={busy || !online}
            onSave={(value) => resolve(item.id, value)}
          />
        </div>
      ))}
      {batch && !items.length && (
        <button className="button" disabled={busy || !online} onClick={() => void resolve()}>
          Concluir conferência
        </button>
      )}
      {!batch && (
        <button
          className="button secondary"
          disabled={busy || !online}
          onClick={() => void refresh()}
        >
          Tentar sincronização novamente
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
