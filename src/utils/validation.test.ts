import { describe, it, expect } from 'vitest';
import { validateAppointment } from './validation';
import { defaults as currentDefaults } from '../data/defaults';
const defaults = {
  ...currentDefaults,
  hours: currentDefaults.hours.map((day, i) => ({ ...day, end: i === 6 ? '13:00' : '18:00' })),
};
import type { Appointment, AppointmentInput } from '../types';
const input: AppointmentInput = {
  nomeCliente: 'Maria',
  telefone: '88999999999',
  servico: 'limpeza-pele',
  valor: 100,
  data: '2026-09-25',
  horaInicio: '14:00',
  horaFim: '15:00',
  duracao: 60,
  observacoes: '',
};
const booked: Appointment = { ...input, id: 'one', createdAt: '', updatedAt: '' };
describe('proteção da agenda', () => {
  it('impede sobreposição parcial e encaixe dentro de outro atendimento', () => {
    expect(validateAppointment({ ...input, horaInicio: '14:30' }, defaults, [booked], [])).toBe(
      'Já existe um atendimento neste horário.',
    );
    expect(
      validateAppointment({ ...input, horaInicio: '13:30', duracao: 120 }, defaults, [booked], []),
    ).toBe('Já existe um atendimento neste horário.');
  });
  it('permite atendimentos adjacentes sem intervalo e ignora o próprio evento na edição', () => {
    expect(
      validateAppointment({ ...input, horaInicio: '15:00' }, defaults, [booked], []),
    ).toBeNull();
    expect(validateAppointment(input, defaults, [booked], [], 'one')).toBeNull();
  });
  it('respeita o intervalo dos dois lados', () => {
    expect(
      validateAppointment(
        { ...input, horaInicio: '15:05' },
        { ...defaults, gap: 10 },
        [booked],
        [],
      ),
    ).not.toBeNull();
    expect(
      validateAppointment(
        { ...input, horaInicio: '12:55' },
        { ...defaults, gap: 10 },
        [booked],
        [],
      ),
    ).not.toBeNull();
    expect(
      validateAppointment(
        { ...input, horaInicio: '15:10' },
        { ...defaults, gap: 10 },
        [booked],
        [],
      ),
    ).toBeNull();
  });
  it('bloqueia domingo e atendimentos que ultrapassem o expediente', () => {
    expect(validateAppointment({ ...input, data: '2026-09-27' }, defaults, [], [])).toContain(
      'não atende',
    );
    expect(validateAppointment({ ...input, horaInicio: '17:30' }, defaults, [], [])).toContain(
      '18:00',
    );
    expect(
      validateAppointment({ ...input, data: '2026-09-26', horaInicio: '12:30' }, defaults, [], []),
    ).toContain('13:00');
  });
  it('considera reservas externas e eventos de dia inteiro', () => {
    expect(
      validateAppointment(
        input,
        defaults,
        [],
        [{ id: 'x', title: 'Reserva', start: '2026-09-25T16:30:00Z', end: '2026-09-25T17:30:00Z' }],
      ),
    ).toContain('Já existe');
    expect(
      validateAppointment(
        input,
        defaults,
        [],
        [{ id: 'x', title: 'Feriado', start: '2026-09-25T03:00:00Z', end: '2026-09-26T03:00:00Z' }],
      ),
    ).toContain('Já existe');
  });
  it('rejeita duração, valor e telefone inválidos', () => {
    expect(validateAppointment({ ...input, duracao: 0 }, defaults, [], [])).not.toBeNull();
    expect(validateAppointment({ ...input, valor: NaN }, defaults, [], [])).not.toBeNull();
    expect(validateAppointment({ ...input, telefone: '123' }, defaults, [], [])).not.toBeNull();
  });
});
