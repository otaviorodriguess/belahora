import { useState, type FormEvent } from 'react';
import { Check, Clock3, LoaderCircle } from 'lucide-react';
import { Modal } from './Modal';
import { services as defaultServices, serviceName } from '../data/services';
import { useAgenda } from '../hooks/useAgenda';
import type { Appointment, AppointmentInput } from '../types';
import { endTime, money } from '../utils/dates';
import { availableTimes } from '../utils/availability';
import { isValid, parseISO } from 'date-fns';
export function AppointmentForm({
  existing,
  reschedule = false,
  onClose,
}: {
  existing?: Appointment;
  reschedule?: boolean;
  onClose: () => void;
}) {
  const { selected, save, ready, canWrite, settings, appointments } = useAgenda();
  const catalog = settings.services ?? defaultServices;
  const services = catalog.filter(
    (s) => s.active !== false || (existing?.servicos ?? [existing?.servico]).includes(s.id),
  );
  const [draft, setDraft] = useState<AppointmentInput>(() =>
    existing
      ? { ...existing }
      : {
          nomeCliente: '',
          telefone: '',
          servico: services[0]?.id ?? '',
          serviceNames: services[0] ? [services[0].nome] : [],
          valor: services[0]?.preco ?? 0,
          data: selected,
          horaInicio: '09:00',
          horaFim: '10:00',
          duracao: services[0]?.duracao ?? 60,
          observacoes: '',
        },
  );
  const [requestId] = useState(() => crypto.randomUUID().replaceAll('-', ''));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [original] = useState(() => JSON.stringify(draft));
  const [discard, setDiscard] = useState(false);
  const close = () => {
    if (JSON.stringify(draft) !== original) setDiscard(true);
    else onClose();
  };
  const slots = availableTimes(draft.data, draft.duracao, settings, appointments, existing?.id);
  const [period, setPeriod] = useState(() =>
    Number(draft.horaInicio.slice(0, 2)) < 12
      ? 0
      : Number(draft.horaInicio.slice(0, 2)) < 18
        ? 1
        : 2,
  );
  const groups = [
    slots.filter((t) => t < '12:00'),
    slots.filter((t) => t >= '12:00' && t < '18:00'),
    slots.filter((t) => t >= '18:00'),
  ];
  const workingDay = isValid(parseISO(draft.data))
    ? settings.hours[parseISO(draft.data).getDay()]
    : undefined;
  const clients = [
    ...new Map(
      [...appointments]
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
        .map((a) => [a.nomeCliente.toLocaleLowerCase('pt-BR'), a]),
    ).values(),
  ];
  const change = <K extends keyof AppointmentInput>(key: K, value: AppointmentInput[K]) =>
    setDraft({ ...draft, [key]: value });
  const selectedServices = draft.servicos?.length ? draft.servicos : [draft.servico];
  const chooseServices = (ids: string[]) => {
    const chosen = ids.map((id) => services.find((s) => s.id === id));
    setDraft({
      ...draft,
      servico: ids[0],
      servicos: ids,
      serviceNames: ids.map((id) => catalog.find((s) => s.id === id)?.nome ?? serviceName(id)),
      valor: chosen.reduce((sum, s) => sum + (s?.preco ?? 0), 0),
      duracao: chosen.reduce((sum, s) => sum + (s?.duracao ?? 0), 0),
    });
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!draft.servico) {
      setError('Adicione ou ative um serviço nas Configurações antes de agendar.');
      return;
    }
    setSaving(true);
    try {
      await save(
        {
          ...draft,
          nomeCliente: draft.nomeCliente.trim(),
          telefone: draft.telefone.trim(),
          observacoes: draft.observacoes.trim(),
          horaFim: endTime(draft.horaInicio, draft.duracao),
        },
        existing,
        requestId,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }
  const blocked = !ready || canWrite === false;
  if (discard)
    return (
      <Modal title="Descartar alterações?" onClose={() => setDiscard(false)}>
        <p className="confirm-copy">
          Você preencheu informações que ainda não foram salvas. Deseja sair deste agendamento?
        </p>
        <div className="modal-actions">
          <button className="button secondary" autoFocus onClick={() => setDiscard(false)}>
            Continuar editando
          </button>
          <button className="button danger" onClick={onClose}>
            Descartar alterações
          </button>
        </div>
      </Modal>
    );
  return (
    <Modal
      title={
        reschedule ? 'Reagendar atendimento' : existing ? 'Editar agendamento' : 'Novo agendamento'
      }
      onClose={close}
      wide
      locked={saving}
    >
      <form onSubmit={submit} className="appointment-form">
        {blocked && (
          <p className="error-message">
            Aguarde o carregamento. Na agenda online, conecte-se à internet e conclua a migração para salvar.
          </p>
        )}
        <div className="form-grid">
          <h3 className="form-section-title">
            <span>01</span> Quem vamos atender?
          </h3>
          <label className="field full">
            Cliente
            <input
              name="client"
              autoFocus={!reschedule}
              required
              maxLength={100}
              autoComplete="name"
              list="existing-clients"
              value={draft.nomeCliente}
              onChange={(e) => {
                const client = clients.find((a) => a.nomeCliente === e.target.value);
                setDraft({
                  ...draft,
                  nomeCliente: e.target.value,
                  telefone: client && !draft.telefone ? client.telefone : draft.telefone,
                });
              }}
              placeholder="Nome da cliente"
            />
          </label>
          <datalist id="existing-clients">
            {clients.map((a) => (
              <option key={a.nomeCliente} value={a.nomeCliente} />
            ))}
          </datalist>
          <label className="field full">
            Telefone<span className="optional">Opcional · com DDD</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={22}
              value={draft.telefone}
              onChange={(e) => change('telefone', e.target.value)}
              placeholder="(88) 99999-9999"
            />
          </label>
          <div className="procedure-picker">
            {selectedServices.map((id, index) => (
              <div className="procedure-row" key={index}>
                <label className="field">
                  {index === 0 ? 'Procedimento' : `Procedimento ${index + 1}`}
                  <select
                    value={id}
                    onChange={(e) =>
                      chooseServices(
                        selectedServices.map((value, i) => (i === index ? e.target.value : value)),
                      )
                    }
                  >
                    {!services.some((s) => s.id === id) && (
                      <option value={id}>
                        {draft.serviceNames?.[index] || serviceName(id) || 'Nenhum serviço ativo'}
                      </option>
                    )}
                    {services
                      .filter((s) => s.id === id || !selectedServices.includes(s.id))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome} · {money(s.preco)} · {s.duracao} min
                        </option>
                      ))}
                  </select>
                </label>
                {selectedServices.length > 1 && (
                  <button
                    type="button"
                    className="text-button"
                    aria-label={`Remover procedimento ${index + 1}`}
                    onClick={() => chooseServices(selectedServices.filter((_, i) => i !== index))}
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="button secondary"
              disabled={selectedServices.length >= services.length || selectedServices.length >= 30}
              onClick={() => {
                const next = services.find((s) => !selectedServices.includes(s.id));
                if (next) chooseServices([...selectedServices, next.id]);
              }}
            >
              + Adicionar procedimento
            </button>
            <p className="helper">
              Os valores e as durações são somados ao alterar os procedimentos. Você pode ajustar os
              totais abaixo.
            </p>
          </div>
          <h3 className="form-section-title">
            <span>02</span> Reserve um momento
          </h3>
          <label className="field">
            Data
            <input
              type="date"
              autoFocus={reschedule}
              required
              min="2000-01-01"
              max="2100-12-31"
              value={draft.data}
              onChange={(e) => change('data', e.target.value)}
            />
          </label>
          <label className="field">
            Horário
            <input
              type="time"
              required
              value={draft.horaInicio}
              onChange={(e) => change('horaInicio', e.target.value)}
            />
          </label>
          <label className="field">
            Duração (min)
            <input
              type="number"
              required
              min={5}
              max={720}
              step={1}
              value={draft.duracao}
              onChange={(e) => change('duracao', e.target.valueAsNumber)}
            />
          </label>
          <label className="field">
            Valor (R$)
            <input
              type="number"
              required
              min={0}
              max={100000}
              step="0.01"
              value={draft.valor}
              onChange={(e) => change('valor', e.target.valueAsNumber)}
            />
          </label>
          <div className="available-times">
            <div>
              <strong>Horários disponíveis</strong>
              <span>
                {workingDay?.active
                  ? `Expediente: ${workingDay.start}–${workingDay.end}. Duração: ${Number.isFinite(draft.duracao) ? draft.duracao : '—'} min.`
                  : 'Escolha uma data com expediente.'}
              </span>
              <span>
                O atendimento precisa terminar dentro do expediente. Toque em um horário de início.
              </span>
            </div>
            {slots.length > 0 ? (
              <div>
                <div className="time-periods" aria-label="Período dos horários">
                  {['Manhã', 'Tarde', 'Noite'].map((name, index) => (
                    <button
                      type="button"
                      key={name}
                      aria-pressed={period === index}
                      onClick={() => setPeriod(index)}
                    >
                      {name} <small>({groups[index].length})</small>
                    </button>
                  ))}
                </div>
                <div className="time-slots">
                  {groups[period].map((time) => (
                    <button
                      type="button"
                      key={time}
                      aria-label={time}
                      className={draft.horaInicio === time ? 'selected' : ''}
                      aria-pressed={draft.horaInicio === time}
                      onClick={() => change('horaInicio', time)}
                    >
                      <strong>{time}</strong>
                      <small>até {endTime(time, draft.duracao)}</small>
                    </button>
                  ))}
                </div>
                {groups[period].length === 0 && (
                  <p>Sem horários livres neste período. Escolha Manhã, Tarde ou Noite acima.</p>
                )}
              </div>
            ) : (
              <p>
                Nenhum encaixe para esta data e duração. Escolha outro dia ou ajuste o expediente
                nas configurações.
              </p>
            )}
          </div>
          <label className="field full">
            Observações<span className="optional">Opcional</span>
            <textarea
              rows={3}
              maxLength={500}
              value={draft.observacoes}
              onChange={(e) => change('observacoes', e.target.value)}
              placeholder="Preferências ou informações sobre o atendimento"
            />
          </label>
        </div>
        <p className="form-summary">
          <Clock3 size={16} />
          Término previsto:{' '}
          <strong>
            {Number.isFinite(draft.duracao) ? endTime(draft.horaInicio, draft.duracao) : '—'}
          </strong>
        </p>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={close} disabled={saving}>
            Voltar
          </button>
          <button type="submit" className="button" disabled={saving || blocked}>
            {saving ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}{' '}
            {saving ? 'Salvando…' : reschedule ? 'Confirmar novo horário' : 'Salvar agendamento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
