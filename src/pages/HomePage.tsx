import { CalendarDays, Wallet, UsersRound, ArrowUpRight, Sparkles } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { useAgenda } from '../hooks/useAgenda';
import { useNow } from '../hooks/useNow';
import { AppointmentCard } from '../components/AppointmentCard';
import type { Appointment } from '../types';
import { todayKey, weekDates, money, instant, TIME_ZONE, displayDate } from '../utils/dates';
export function HomePage({
  onOpen,
  onAgenda,
}: {
  onOpen: (a: Appointment) => void;
  onAgenda: () => void;
}) {
  const { appointments, settings } = useAgenda();
  const now = useNow();
  const today = todayKey();
  const week = weekDates(today);
  const day = appointments.filter((a) => a.data === today);
  const total = (rows: Appointment[]) => money(rows.reduce((s, a) => s + a.valor, 0));
  const upcoming = appointments
    .filter((a) => Date.parse(instant(a.data, a.horaFim)) > now)
    .sort((a, b) => `${a.data}${a.horaInicio}`.localeCompare(`${b.data}${b.horaInicio}`));
  const hour = Number(formatInTimeZone(now, TIME_ZONE, 'H'));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{displayDate(today, "EEEE, dd 'de' MMMM").toUpperCase()}</span>
          <h1>
            {hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'}
            {settings.professional ? `, ${settings.professional.split(' ')[0]}` : ''}{' '}
            <span className="greeting-wave">👋</span>
          </h1>
          <p>Seu dia, com mais tempo para cuidar.</p>
        </div>
      </div>
      <div className="stats-grid home-stats">
        <div className="stat-card">
          <span className="stat-icon">
            <CalendarDays size={20} />
          </span>
          <div>
            <span>Atendimentos de hoje</span>
            <strong>{day.length}</strong>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon gold">
            <Wallet size={20} />
          </span>
          <div>
            <span>Valor previsto do dia</span>
            <strong>{total(day)}</strong>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon neutral">
            <UsersRound size={20} />
          </span>
          <div>
            <span>Clientes hoje</span>
            <strong>
              {new Set(day.map((a) => a.nomeCliente.trim().toLocaleLowerCase('pt-BR'))).size}
            </strong>
          </div>
        </div>
      </div>
      <div className="home-columns">
        <section className="panel next-panel">
          <span className="eyebrow">A SEGUIR NA SUA AGENDA</span>
          <h2>Próximo atendimento</h2>
          {upcoming[0] ? (
            <>
              <p className="next-date">{displayDate(upcoming[0].data, "EEEE, dd 'de' MMMM")}</p>
              <AppointmentCard appointment={upcoming[0]} onOpen={onOpen} />
            </>
          ) : (
            <div className="empty-state">
              <Sparkles />
              <p>Nenhum atendimento a seguir.</p>
            </div>
          )}
          <button className="text-button" onClick={onAgenda}>
            Ver agenda completa <ArrowUpRight size={16} />
          </button>
        </section>
        <section className="panel finance-panel">
          <h2>Resumo financeiro</h2>
          <p className="muted small">Valores previstos dos atendimentos</p>
          <dl>
            {[
              ['Hoje', total(day)],
              ['Semana', total(appointments.filter((a) => week.includes(a.data)))],
              ['Mês', total(appointments.filter((a) => a.data.slice(0, 7) === today.slice(0, 7)))],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <section className="upcoming-section">
        <div className="section-heading">
          <h2>Próximos atendimentos</h2>
          <span className="muted small">{upcoming.length} na agenda</span>
        </div>
        <div className="upcoming-grid">
          {upcoming.slice(1, 7).map((a) => (
            <AppointmentCard key={a.id} appointment={a} onOpen={onOpen} showDate />
          ))}
        </div>
        {upcoming.length <= 1 && <p className="muted">Os próximos atendimentos aparecerão aqui.</p>}
      </section>
    </>
  );
}
