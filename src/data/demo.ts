import { addDays, parseISO } from 'date-fns';
import type { Appointment } from '../types';
import { services } from './services';
import { dateKey, endTime, todayKey } from '../utils/dates';
export function createDemo(): Appointment[] {
  const today = parseISO(todayKey());
  const rows: [number, string, string, number][] = [
    [0, 'Maria Silva', '09:00', 0],
    [0, 'Larissa Oliveira', '11:00', 4],
    [0, 'Camila Santos', '15:30', 1],
    [1, 'Beatriz Costa', '10:00', 2],
    [1, 'Ana Paula', '14:00', 3],
    [2, 'Juliana Lima', '09:30', 5],
    [4, 'Fernanda Alves', '10:00', 13],
    [-1, 'Maria Silva', '10:00', 4],
    [-3, 'Isabela Rocha', '14:00', 0],
    [-7, 'Camila Santos', '09:00', 1],
    [-9, 'Larissa Oliveira', '11:00', 5],
    [7, 'Mariana Souza', '10:00', 2],
  ];
  return rows.map(([offset, name, time, index], i) => {
    const service = services[index];
    const date = dateKey(addDays(today, offset));
    return {
      id: `demo-${i}`,
      nomeCliente: name,
      telefone: '',
      servico: service.id,
      valor: service.preco,
      data: date,
      horaInicio: time,
      horaFim: endTime(time, service.duracao),
      duracao: service.duracao,
      observacoes: 'Agendamento de demonstração.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
}
