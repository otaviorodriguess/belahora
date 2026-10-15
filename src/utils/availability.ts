import { isValid, parseISO } from 'date-fns';
import type { Appointment, Settings } from '../types';
import { endTime, minutes } from './dates';
import { validateAppointment } from './validation';
export function availableTimes(
  date: string,
  duration: number,
  settings: Settings,
  appointments: Appointment[],
  ignoreId?: string,
): string[] {
  if (!isValid(parseISO(date)) || !Number.isInteger(duration) || duration < 5 || duration > 720)
    return [];
  const day = settings.hours[parseISO(date).getDay()];
  if (!day?.active) return [];
  const slots: string[] = [];
  for (let start = minutes(day.start); start + duration <= minutes(day.end); start += 15) {
    const time = endTime('00:00', start);
    if (
      !validateAppointment(
        {
          nomeCliente: 'Disponibilidade',
          telefone: '',
          servico: '',
          valor: 0,
          data: date,
          horaInicio: time,
          horaFim: endTime(time, duration),
          duracao: duration,
          observacoes: '',
        },
        settings,
        appointments,
        [],
        ignoreId,
      )
    )
      slots.push(time);
  }
  return slots;
}
