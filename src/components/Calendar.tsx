import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import type { Appointment } from '../types';
import { dateKey, displayDate, todayKey, weekDates } from '../utils/dates';
export type CalendarView = 'month' | 'week' | 'day';
export function Calendar({
  selected,
  onSelect,
  appointments,
  view,
  setView,
}: {
  selected: string;
  onSelect: (d: string) => void;
  appointments: Appointment[];
  view: CalendarView;
  setView: (v: CalendarView) => void;
}) {
  const date = parseISO(selected);
  const first = startOfWeek(startOfMonth(date));
  const last = endOfWeek(endOfMonth(date));
  const all: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) all.push(dateKey(d));
  const days = view === 'month' ? all : view === 'week' ? weekDates(selected) : [selected];
  const move = (dir: number) =>
    onSelect(
      dateKey(
        view === 'month' ? addMonths(date, dir) : addDays(date, dir * (view === 'week' ? 7 : 1)),
      ),
    );
  return (
    <section className="calendar-panel panel">
      <div className="calendar-top">
        <div>
          <span className="eyebrow">SEU TEMPO, BEM CUIDADO</span>
          <h2>{displayDate(selected, 'MMMM yyyy')}</h2>
        </div>
        <div className="calendar-arrows">
          <button
            className="icon-button"
            aria-label={view === 'month' ? 'Mês anterior' : 'Período anterior'}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={19} />
          </button>
          <button
            className="icon-button"
            aria-label={view === 'month' ? 'Mês seguinte' : 'Próximo período'}
            onClick={() => move(1)}
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </div>
      <div className="calendar-controls">
        <div className="segmented" aria-label="Visualização da agenda">
          {(['month', 'week', 'day'] as const).map((v, i) => (
            <button
              key={v}
              aria-pressed={view === v}
              className={view === v ? 'active' : ''}
              onClick={() => setView(v)}
            >
              {['Mês', 'Semana', 'Dia'][i]}
            </button>
          ))}
        </div>
        <button className="text-button" onClick={() => onSelect(todayKey())}>
          Hoje
        </button>
      </div>
      <div className="date-shortcuts">
        <button onClick={() => onSelect(dateKey(addDays(parseISO(todayKey()), 1)))}>Amanhã</button>
        <button onClick={() => onSelect(dateKey(addDays(parseISO(todayKey()), 7)))}>
          Próxima semana
        </button>
        <label className="jump-date">
          <CalendarDays size={15} />
          <span className="sr-only">Ir para uma data</span>
          <input
            aria-label="Ir para uma data"
            type="date"
            min="2000-01-01"
            max="2100-12-31"
            value={selected}
            onChange={(e) => {
              if (e.target.value) onSelect(e.target.value);
            }}
          />
        </label>
      </div>
      {view !== 'day' && (
        <div className="weekdays">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
      )}
      <div className={`calendar-grid view-${view}`}>
        {days.map((d) => {
          const count = appointments.filter((a) => a.data === d).length;
          return (
            <button
              key={d}
              className={`calendar-day ${d === selected ? 'selected' : ''} ${d === todayKey() ? 'today' : ''} ${d.slice(0, 7) !== selected.slice(0, 7) ? 'muted-day' : ''}`}
              aria-label={`${displayDate(d, 'dd/MM/yyyy')}, ${count} atendimentos`}
              aria-pressed={d === selected}
              onClick={() => onSelect(d)}
            >
              <span>
                {view === 'day' ? displayDate(d, "EEEE, dd 'de' MMMM") : Number(d.slice(-2))}
              </span>
              <div className="date-dots">
                {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                  <i key={i} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        <i /> Com agendamentos <span className="today-ring" /> Hoje
      </div>
    </section>
  );
}
