import { useState } from 'react';
import { Plus, Scissors } from 'lucide-react';
import type { Service } from '../types';
import { money } from '../utils/dates';

export function ServicesEditor({
  services,
  onChange,
  saving,
}: {
  services: Service[];
  onChange: (services: Service[]) => void;
  saving: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const update = (id: string, patch: Partial<Service>) =>
    onChange(services.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  return (
    <section
      className="panel settings-panel service-catalog"
      onInvalidCapture={(e) => {
        const details = (e.target as HTMLElement).closest('details');
        if (details) {
          details.open = true;
          setExpanded(
            services[Array.from(details.parentElement!.children).indexOf(details)]?.id ?? null,
          );
        }
      }}
    >
      <div className="catalog-heading">
        <div>
          <span className="eyebrow">SEU MENU DE CUIDADOS</span>
          <h2>
            <Scissors size={21} /> Serviços e preços
          </h2>
        </div>
        <span className="catalog-count">
          {services.filter((s) => s.active !== false).length} ativos
        </span>
      </div>
      <p className="muted small">
        Personalize seus procedimentos. Alterações de preço e duração valem para novos agendamentos.
      </p>
      <div className="catalog-list">
        {services.map((s) => (
          <details
            key={s.id}
            open={expanded === s.id}
            onToggle={(e) => {
              if (e.currentTarget.open) setExpanded(s.id);
              else setExpanded((current) => (current === s.id ? null : current));
            }}
          >
            <summary>
              <span>
                <strong>{s.nome || 'Novo serviço'}</strong>
                <small>
                  {s.active === false ? 'Desativado · ' : ''}
                  {Number.isFinite(s.duracao) ? s.duracao : '—'} min
                </small>
              </span>
              <span className="catalog-price">
                {Number.isFinite(s.preco) ? money(s.preco) : '—'}
                <small>Editar</small>
              </span>
            </summary>
            <div className="catalog-fields">
              <label className="field full">
                Nome do serviço
                <input
                  required
                  maxLength={100}
                  value={s.nome}
                  onChange={(e) => update(s.id, { nome: e.target.value })}
                />
              </label>
              <label className="field">
                Preço (R$)
                <input
                  type="number"
                  inputMode="decimal"
                  required
                  min={0}
                  max={100000}
                  step="0.01"
                  value={Number.isFinite(s.preco) ? s.preco : ''}
                  onChange={(e) => update(s.id, { preco: e.target.valueAsNumber })}
                />
              </label>
              <label className="field">
                Duração (minutos)
                <input
                  type="number"
                  inputMode="numeric"
                  required
                  min={5}
                  max={720}
                  step={1}
                  value={Number.isFinite(s.duracao) ? s.duracao : ''}
                  onChange={(e) => update(s.id, { duracao: e.target.valueAsNumber })}
                />
              </label>
              <label className="catalog-active">
                <input
                  type="checkbox"
                  checked={s.active !== false}
                  onChange={(e) => update(s.id, { active: e.target.checked })}
                />
                Disponível para agendar
              </label>
              <p className="helper full">
                Desativar mantém os atendimentos anteriores no histórico.
              </p>
            </div>
          </details>
        ))}
      </div>
      {!services.length && (
        <p className="muted">Adicione seu primeiro serviço para começar a agendar.</p>
      )}
      <button
        type="button"
        className="button secondary"
        disabled={services.length >= 300}
        onClick={() => {
          const id = crypto.randomUUID();
          onChange([
            ...services,
            { id, nome: 'Novo serviço', preco: 0, duracao: 30, active: true },
          ]);
          setExpanded(id);
        }}
      >
        <Plus size={17} />
        Adicionar serviço
      </button>
      <button type="submit" className="button catalog-save" disabled={saving}>
        {saving ? 'Salvando…' : 'Salvar serviços'}
      </button>
      <p className="helper">
        Salva os serviços e as demais configurações preenchidas nesta página.
      </p>
    </section>
  );
}
