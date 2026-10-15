import { parseISO, isValid } from 'date-fns';
import type { Appointment, AppointmentInput, BusyEvent, Settings } from '../types';
import { endTime, instant, minutes } from './dates';
export function validateAppointment(
  input: AppointmentInput,
  settings: Settings,
  appointments: Appointment[],
  busy: BusyEvent[],
  ignoreId?: string,
): string | null {
  if (!input.nomeCliente.trim() || input.nomeCliente.trim().length > 100)
    return 'Informe o nome da cliente (até 100 caracteres).';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data) || !isValid(parseISO(input.data)))
    return 'Informe uma data válida.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.horaInicio)) return 'Informe um horário válido.';
  if (!Number.isInteger(input.duracao) || input.duracao < 5 || input.duracao > 720)
    return 'A duração deve ser entre 5 e 720 minutos.';
  if (!Number.isFinite(input.valor) || input.valor < 0 || input.valor > 100000)
    return 'Informe um valor válido.';
  const phone = input.telefone.replace(/\D/g, '');
  if (phone && !/^(?:55)?\d{10,11}$/.test(phone))
    return 'Informe um telefone com DDD (10 ou 11 dígitos, com 55 opcional).';
  const day = settings.hours[parseISO(input.data).getDay()];
  const start = minutes(input.horaInicio),
    end = start + input.duracao;
  if (!day.active) return 'O espaço não atende neste dia da semana. Confira as configurações.';
  if (end > 1439 || start < minutes(day.start) || end > minutes(day.end))
    return `Escolha um horário entre ${day.start} e ${day.end}, considerando a duração.`;
  const conflict = appointments.some(
    (a) =>
      a.id !== ignoreId &&
      a.data === input.data &&
      start < minutes(a.horaFim) + settings.gap &&
      end + settings.gap > minutes(a.horaInicio),
  );
  const beginMs = Date.parse(instant(input.data, input.horaInicio));
  const endMs = Date.parse(instant(input.data, endTime(input.horaInicio, input.duracao)));
  const externalConflict = busy.some(
    (e) =>
      beginMs < Date.parse(e.end) + settings.gap * 60000 &&
      endMs + settings.gap * 60000 > Date.parse(e.start),
  );
  return conflict || externalConflict ? 'Já existe um atendimento neste horário.' : null;
}
