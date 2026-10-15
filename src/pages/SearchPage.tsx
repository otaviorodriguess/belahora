import { useState } from 'react';
import { Search, History, CalendarDays } from 'lucide-react';
import { useAgenda } from '../hooks/useAgenda';
import { useNow } from '../hooks/useNow';
import { AppointmentCard } from '../components/AppointmentCard';
import type { Appointment } from '../types';
import { instant } from '../utils/dates';
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
export function SearchPage({ onOpen }: { onOpen: (a: Appointment) => void }) {
  const { appointments } = useAgenda();
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState(false);
  const [limit, setLimit] = useState(30);
  const now = useNow();
  const rows = appointments
    .filter(
      (a) =>
        (!history || Date.parse(instant(a.data, a.horaFim)) < now) &&
        normalize(a.nomeCliente).includes(normalize(query.trim())),
    )
    .sort((a, b) => `${b.data}${b.horaInicio}`.localeCompare(`${a.data}${a.horaInicio}`));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CADA CLIENTE, UMA HISTÓRIA</span>
          <h1>
            Buscar<span className="heading-dot">.</span>
          </h1>
          <p>Encontre clientes e seus atendimentos.</p>
        </div>
      </div>
      <div className="search-toolbar">
        <label className="search-input">
          <Search size={20} />
          <input
            aria-label="Buscar por cliente"
            type="search"
            placeholder="Buscar pelo nome da cliente…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(30);
            }}
          />
        </label>
        <div className="segmented">
          <button
            className={!history ? 'active' : ''}
            aria-pressed={!history}
            onClick={() => {
              setHistory(false);
              setLimit(30);
            }}
          >
            <CalendarDays size={15} />
            Todos
          </button>
          <button
            className={history ? 'active' : ''}
            aria-pressed={history}
            onClick={() => {
              setHistory(true);
              setLimit(30);
            }}
          >
            <History size={15} />
            Histórico
          </button>
        </div>
      </div>
      <div className="search-caption">
        <span>
          {rows.length} {rows.length === 1 ? 'atendimento encontrado' : 'atendimentos encontrados'}
        </span>
        <span>Todos os atendimentos da sua agenda</span>
      </div>
      <div className="search-grid">
        {rows.slice(0, limit).map((a) => (
          <AppointmentCard key={a.id} appointment={a} onOpen={onOpen} showDate />
        ))}
      </div>
      {rows.length === 0 && (
        <div className="empty-state">
          <Search size={32} />
          <h3>Nenhum atendimento encontrado</h3>
          <p>
            {query
              ? 'Tente outro nome ou consulte todos os atendimentos.'
              : 'Os atendimentos aparecerão aqui.'}
          </p>
        </div>
      )}
      {rows.length > limit && (
        <button className="button secondary" onClick={() => setLimit(limit + 30)}>
          Mostrar mais
        </button>
      )}
    </>
  );
}
