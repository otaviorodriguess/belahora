import { ArrowUpRight, Clock3 } from 'lucide-react';
import type { Appointment } from '../types';
import { serviceName } from '../data/services';
import { money, displayDate } from '../utils/dates';
export function AppointmentCard({
  appointment: a,
  onOpen,
  showDate = false,
}: {
  appointment: Appointment;
  onOpen: (a: Appointment) => void;
  showDate?: boolean;
}) {
  return (
    <button className="appointment-card" onClick={() => onOpen(a)}>
      <div className="appointment-time">
        <strong>{a.horaInicio}</strong>
        <span>{a.horaFim}</span>
      </div>
      <div className={`avatar tone-${a.servico.length % 3}`}>
        {a.nomeCliente
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')}
      </div>
      <div className="appointment-info">
        <strong>{a.nomeCliente}</strong>
        <span>{serviceName(a.servico, a.servicos, a.serviceNames)}</span>
        <small>
          <Clock3 size={13} />
          {showDate ? displayDate(a.data, 'dd/MM/yyyy') + ' · ' : ''}
          {a.duracao} min
        </small>
      </div>
      <div className="appointment-price">
        <strong>{money(a.valor)}</strong>
        <ArrowUpRight size={17} />
      </div>
    </button>
  );
}

