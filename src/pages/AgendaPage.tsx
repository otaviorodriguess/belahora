import { useState } from 'react';
import { CalendarDays, Plus, ArrowUpRight, Clock3, UsersRound, Wallet } from 'lucide-react';
import type { Appointment, BusyEvent } from '../types';
import { Calendar, type CalendarView } from '../components/Calendar';
import { AppointmentCard } from '../components/AppointmentCard';
import { displayDate, money, weekDates, instant } from '../utils/dates';
import { serviceName } from '../data/services';
import { useNow } from '../hooks/useNow';
export function AgendaPage({
  appointments,
  busy,
  selected,
  onSelect,
  onOpen,
  onAdd,
  readOnly = false,
}: {
  appointments: Appointment[];
  busy: BusyEvent[];
  selected: string;
  onSelect: (d: string) => void;
  onOpen: (a: Appointment) => void;
  onAdd: () => void;
  readOnly?: boolean;
}) {
  const [view, setView] = useState<CalendarView>('month');
  const daily = appointments
    .filter((a) => a.data === selected)
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  const dates = view === 'week' ? weekDates(selected) : [selected];
  const period = appointments.filter((a) => dates.includes(a.data));
  const now = useNow();
  const next = appointments
    .filter((a) => Date.parse(instant(a.data, a.horaFim)) > now)
    .sort((a, b) => `${a.data}${a.horaInicio}`.localeCompare(`${b.data}${b.horaInicio}`))[0];
  const external = busy.filter(
    (b) =>
      Date.parse(b.start) < Date.parse(instant(selected, '23:59')) &&
      Date.parse(b.end) > Date.parse(instant(selected, '00:00')),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SEU DIA, COM MAIS LEVEZA</span>
          <h1>
            Agenda<span className="heading-dot">.</span>
          </h1>
          <p>Um toque para organizar seu próximo atendimento.</p>
        </div>
        <div className="heading-date">
          <CalendarDays size={18} />
          {displayDate(selected, "dd 'de' MMMM")}
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon">
            <CalendarDays size={20} />
          </span>
          <div>
            <span>{view === 'week' ? 'Atendimentos na semana' : 'Atendimentos do dia'}</span>
            <strong>{String(period.length).padStart(2, '0')}</strong>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon gold">
            <Wallet size={20} />
          </span>
          <div>
            <span>{view === 'week' ? 'Previsto na semana' : 'Valor previsto do dia'}</span>
            <strong>{money(period.reduce((s, a) => s + a.valor, 0))}</strong>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon neutral">
            <UsersRound size={20} />
          </span>
          <div>
            <span>{view === 'week' ? 'Clientes na semana' : 'Clientes no dia'}</span>
            <strong>
              {String(
                new Set(period.map((a) => a.nomeCliente.trim().toLocaleLowerCase('pt-BR'))).size,
              ).padStart(2, '0')}
            </strong>
          </div>
        </div>
      </div>
      <div className="agenda-columns">
        <div>
          <Calendar
            selected={selected}
            onSelect={onSelect}
            appointments={appointments}
            view={view}
            setView={setView}
          />
          {next && (
            <button className="next-appointment" onClick={() => onOpen(next)}>
              <span className="next-date-badge">
                <strong>{displayDate(next.data, 'dd')}</strong>
                <span>{displayDate(next.data, 'MMM')}</span>
              </span>
              <span className="next-appointment-copy">
                <span className="eyebrow">PRÓXIMO ATENDIMENTO</span>
                <strong>{next.nomeCliente}</strong>
                <span>
                  {next.horaInicio} · {serviceName(next.servico, next.servicos, next.serviceNames)}
                </span>
              </span>
              <ArrowUpRight size={19} />
            </button>
          )}
        </div>
        <section className="day-panel">
          <div className="day-caption">
            <span>{displayDate(selected, 'dd')}</span>
            <div>
              {displayDate(selected, 'MMMM')}
              <small>{displayDate(selected, 'yyyy')}</small>
            </div>
            <span className="day-caption-line" />
          </div>
          <div className="section-heading">
            <div>
              <span className="eyebrow">{displayDate(selected, 'EEEE').toUpperCase()}</span>
              <h2>{view === 'week' ? 'Agendamentos da semana' : 'Agendamentos do dia'}</h2>
            </div>
            <button
              className="icon-button outlined"
              aria-label="Adicionar atendimento"
              disabled={readOnly}
              onClick={onAdd}
            >
              <Plus size={19} />
            </button>
          </div>
          <div className="selected-date">
            {view === 'week'
              ? `${displayDate(dates[0], 'dd/MM')} a ${displayDate(dates[6], 'dd/MM')}`
              : displayDate(selected, "dd 'de' MMMM")}
            <span>
              {period.length} {period.length === 1 ? 'atendimento' : 'atendimentos'}
            </span>
          </div>
          {dates.map((d) => {
            const rows = appointments
              .filter((a) => a.data === d)
              .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
            return (
              <div key={d}>
                {view === 'week' && <h3 className="week-group">{displayDate(d, 'EEE, dd/MM')}</h3>}
                {rows.map((a) => (
                  <AppointmentCard key={a.id} appointment={a} onOpen={onOpen} />
                ))}
                {rows.length === 0 && view === 'week' && (
                  <p className="muted small">Sem atendimentos.</p>
                )}
              </div>
            );
          })}
          {daily.length === 0 && view !== 'week' && (
            <div className="empty-state">
              <CalendarDays size={32} />
              <h3>Um espaço na sua agenda</h3>
              <p>Nenhum atendimento para este dia.</p>
              <button className="button secondary" disabled={readOnly} onClick={onAdd}>
                Agendar atendimento <ArrowUpRight size={16} />
              </button>
            </div>
          )}
          {external.length > 0 && (
            <div className="external-events">
              <h3>Reservas do Google Agenda</h3>
              {external.map((b) => (
                <p key={b.id}>
                  <Clock3 size={15} />
                  {b.title}
                </p>
              ))}
              <small>Estes períodos bloqueiam novos agendamentos. Edite no Google Agenda.</small>
            </div>
          )}
          <div className="day-total">
            <span>{view === 'week' ? 'Total previsto na semana' : 'Total previsto no dia'}</span>
            <strong>{money(period.reduce((s, a) => s + a.valor, 0))}</strong>
          </div>
          <p className="helper">Valores previstos, sem controle de pagamento.</p>
        </section>
      </div>
    </>
  );
}

