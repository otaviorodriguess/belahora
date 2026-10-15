import { useState } from 'react';
import { CalendarDays, Clock3, MessageCircle, Pencil, Trash2, CalendarClock } from 'lucide-react';
import type { Appointment } from '../types';
import { Modal } from './Modal';
import { useAgenda } from '../hooks/useAgenda';
import { serviceName } from '../data/services';
import { displayDate, money } from '../utils/dates';
export function AppointmentDetails({
  appointment: a,
  onClose,
  onEdit,
}: {
  appointment: Appointment;
  onClose: () => void;
  onEdit: (reschedule: boolean) => void;
}) {
  const { remove, ready, canWrite, readOnly } = useAgenda();
  const [confirm, setConfirm] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const phone = a.telefone.replace(/\D/g, '');
  const fullPhone = phone.startsWith('55') && phone.length > 11 ? phone : `55${phone}`;
  const whatsapp = `https://wa.me/${fullPhone}?text=${encodeURIComponent(`Olá, ${a.nomeCliente.split(' ')[0]}! Tudo bem?\nPassando para confirmar seu horário de ${serviceName(a.servico, a.servicos, a.serviceNames)} no dia ${displayDate(a.data, 'dd/MM')} às ${a.horaInicio}. 💗`)}`;
  async function cancel() {
    setWorking(true);
    try {
      await remove(a);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível cancelar.');
    } finally {
      setWorking(false);
    }
  }
  const blocked = !ready || canWrite === false;
  return (
    <Modal
      title={confirm ? 'Cancelar agendamento?' : 'Detalhes do agendamento'}
      onClose={onClose}
      locked={working}
    >
      <div className="details-hero">
        <div className="avatar large">
          {a.nomeCliente
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')}
        </div>
        <h3>{a.nomeCliente}</h3>
        <p>{serviceName(a.servico, a.servicos, a.serviceNames)}</p>
        <strong>{money(a.valor)}</strong>
      </div>
      {confirm ? (
        <>
          <p className="confirm-copy">
            O atendimento de {a.nomeCliente} em {displayDate(a.data)} às {a.horaInicio} será
            removido deste aparelho.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={working}
              onClick={() => setConfirm(false)}
            >
              Manter atendimento
            </button>
            <button className="button danger" disabled={working} onClick={() => void cancel()}>
              {working ? 'Cancelando…' : 'Sim, cancelar'}
            </button>
          </div>
        </>
      ) : (
        <>
          <dl className="details-list">
            <div>
              <dt>
                <CalendarDays size={17} />
                Data
              </dt>
              <dd>{displayDate(a.data, 'dd/MM/yyyy')}</dd>
            </div>
            <div>
              <dt>
                <Clock3 size={17} />
                Horário
              </dt>
              <dd>
                {a.horaInicio} – {a.horaFim} · {a.duracao} min
              </dd>
            </div>
            <div>
              <dt>Telefone</dt>
              <dd>{a.telefone || 'Não informado'}</dd>
            </div>
            <div className="notes">
              <dt>Observações</dt>
              <dd>{a.observacoes || 'Nenhuma observação.'}</dd>
            </div>
          </dl>
          {phone && !readOnly && (
            <a
              className="button whatsapp"
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={18} />
              WhatsApp
            </a>
          )}
          <div className="detail-actions">
            <button className="button secondary" disabled={blocked} onClick={() => onEdit(false)}>
              <Pencil size={16} />
              Editar
            </button>
            <button className="button secondary" disabled={blocked} onClick={() => onEdit(true)}>
              <CalendarClock size={16} />
              Reagendar
            </button>
            <button className="button ghost" disabled={blocked} onClick={() => setConfirm(true)}>
              <Trash2 size={16} />
              Cancelar
            </button>
          </div>
          {blocked && <p className="helper">{readOnly ? 'Na demonstração, os atendimentos podem ser consultados, mas não alterados.' : 'Aguarde o carregamento e verifique a conexão antes de alterar.'}</p>}
        </>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}

