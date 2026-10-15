import { expect, it } from 'vitest';
import { availableTimes } from './availability';
import { defaults as currentDefaults } from '../data/defaults';
const defaults = {
  ...currentDefaults,
  hours: currentDefaults.hours.map((day, i) => ({ ...day, end: i === 6 ? '13:00' : '18:00' })),
};
import type { Appointment } from '../types';

it('sugere apenas encaixes que respeitam expediente, duração e intervalo', () => {
  const appointment: Appointment = {
    id: 'one',
    nomeCliente: 'Maria',
    telefone: '',
    servico: 'limpeza-pele',
    valor: 100,
    data: '2026-10-02',
    horaInicio: '14:00',
    horaFim: '15:00',
    duracao: 60,
    observacoes: '',
    createdAt: '',
    updatedAt: '',
  };
  const slots = availableTimes(appointment.data, 60, { ...defaults, gap: 15 }, [appointment]);
  expect(slots).not.toContain('13:00');
  expect(slots).not.toContain('15:00');
  expect(slots).toContain('12:45');
  expect(slots).toContain('15:15');
  expect(slots).toContain('17:00');
  expect(slots).not.toContain('17:15');
  expect(availableTimes(appointment.data, 60, defaults, [appointment], 'one')).toContain('14:00');
});

it('não sugere horários em dias fechados ou para valores inválidos', () => {
  expect(availableTimes('2026-09-27', 60, defaults, [])).toEqual([]);
  expect(availableTimes('', 60, defaults, [])).toEqual([]);
  expect(availableTimes('2026-10-02', NaN, defaults, [])).toEqual([]);
});
