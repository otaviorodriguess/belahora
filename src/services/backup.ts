import { isValid, parseISO } from 'date-fns';
import type { AgendaBackup, Appointment, LocalAgenda, Settings } from '../types';
import { endTime, minutes } from '../utils/dates';
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max;
const time = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const stamp = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
export function validateBackupSettings(value: unknown): Settings {
  if (
    !object(value) ||
    !text(value.professional, 80) ||
    !text(value.studio, 80) ||
    !value.studio.trim() ||
    !Number.isInteger(value.gap) ||
    Number(value.gap) < 0 ||
    Number(value.gap) > 120 ||
    !Array.isArray(value.hours) ||
    value.hours.length !== 7
  )
    throw new Error('Configurações inválidas no backup.');
  const hours = value.hours.map((day) => {
    if (
      !object(day) ||
      typeof day.active !== 'boolean' ||
      !time(day.start) ||
      !time(day.end) ||
      day.start >= day.end
    )
      throw new Error('Horários de funcionamento inválidos no backup.');
    return { active: day.active, start: day.start, end: day.end };
  });
  let catalog;
  if (value.services !== undefined) {
    if (!Array.isArray(value.services) || value.services.length > 300)
      throw new Error('Lista de serviços inválida.');
    const ids = new Set<string>();
    catalog = value.services.map((s) => {
      if (
        !object(s) ||
        !text(s.id, 160) ||
        !s.id ||
        ids.has(s.id) ||
        !text(s.nome, 100) ||
        !s.nome.trim() ||
        typeof s.preco !== 'number' ||
        !Number.isFinite(s.preco) ||
        s.preco < 0 ||
        s.preco > 100000 ||
        !Number.isInteger(s.duracao) ||
        Number(s.duracao) < 5 ||
        Number(s.duracao) > 720 ||
        (s.active !== undefined && typeof s.active !== 'boolean')
      )
        throw new Error('Confira os serviços: nome, preço e duração de 5 a 720 minutos.');
      ids.add(s.id);
      return {
        id: s.id,
        nome: s.nome.trim(),
        preco: s.preco,
        duracao: Number(s.duracao),
        active: s.active !== false,
      };
    });
  }
  return {
    professional: value.professional,
    studio: value.studio,
    gap: Number(value.gap),
    hours,
    mode: 'local',
    ...(catalog ? { services: catalog } : {}),
  };
}
export function parseBackup(content: string): AgendaBackup {
  if (new Blob([content]).size > MAX_BACKUP_BYTES) throw new Error('O backup deve ter até 10 MB.');
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error(
      'Não foi possível ler o arquivo. Selecione um backup JSON exportado pela Bela Hora.',
    );
  }
  if (
    !object(data) ||
    data.format !== 'aura-agenda' ||
    data.version !== 1 ||
    !stamp(data.exportedAt) ||
    !Array.isArray(data.appointments) ||
    data.appointments.length > 20000
  )
    throw new Error('Este arquivo não é um backup compatível da Bela Hora.');
  const settings = validateBackupSettings(data.settings);
  const ids = new Set<string>();
  const appointments: Appointment[] = data.appointments.map((raw: unknown) => {
    if (
      !object(raw) ||
      !text(raw.id, 160) ||
      !raw.id ||
      ids.has(raw.id) ||
      !text(raw.nomeCliente, 100) ||
      !raw.nomeCliente.trim() ||
      !text(raw.telefone, 22) ||
      !text(raw.servico, 200) ||
      !raw.servico ||
      !text(raw.observacoes, 500) ||
      typeof raw.valor !== 'number' ||
      !Number.isFinite(raw.valor) ||
      raw.valor < 0 ||
      raw.valor > 100000 ||
      !Number.isInteger(raw.duracao) ||
      Number(raw.duracao) < 5 ||
      Number(raw.duracao) > 720 ||
      !text(raw.data, 10) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(raw.data) ||
      !isValid(parseISO(raw.data)) ||
      !time(raw.horaInicio) ||
      !time(raw.horaFim) ||
      minutes(raw.horaInicio) + Number(raw.duracao) > 1439 ||
      raw.horaFim !== endTime(raw.horaInicio, Number(raw.duracao)) ||
      !stamp(raw.createdAt) ||
      !stamp(raw.updatedAt)
    )
      throw new Error(
        'O backup contém um atendimento inválido ou repetido. Nenhum dado foi alterado.',
      );
    ids.add(raw.id);
    if (
      raw.serviceNames !== undefined &&
      (!Array.isArray(raw.serviceNames) ||
        raw.serviceNames.length !== (Array.isArray(raw.servicos) ? raw.servicos.length : 1) ||
        raw.serviceNames.some((name) => !text(name, 100) || !name.trim()))
    )
      throw new Error('Nomes de procedimentos inválidos no backup.');
    if (
      raw.servicos !== undefined &&
      (!Array.isArray(raw.servicos) ||
        !raw.servicos.length ||
        raw.servicos.length > 30 ||
        raw.servicos.some((id) => !text(id, 200) || !id.trim()) ||
        new Set(raw.servicos).size !== raw.servicos.length ||
        raw.servicos[0] !== raw.servico)
    )
      throw new Error('Lista de procedimentos inválida no backup. Nenhum dado foi alterado.');
    return {
      id: raw.id,
      nomeCliente: raw.nomeCliente,
      telefone: raw.telefone,
      servico: raw.servico,
      ...(raw.serviceNames ? { serviceNames: [...(raw.serviceNames as string[])] } : {}),
      ...(raw.servicos ? { servicos: [...(raw.servicos as string[])] } : {}),
      observacoes: raw.observacoes,
      valor: raw.valor,
      duracao: Number(raw.duracao),
      data: raw.data,
      horaInicio: raw.horaInicio,
      horaFim: raw.horaFim,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  });
  return {
    format: 'aura-agenda',
    version: 1,
    exportedAt: data.exportedAt,
    settings,
    appointments,
    updatedAt: stamp(data.updatedAt) ? data.updatedAt : data.exportedAt,
  };
}
export function createBackup(state: LocalAgenda): AgendaBackup {
  return { ...state, format: 'aura-agenda', version: 1, exportedAt: new Date().toISOString() };
}
export function downloadBackup(state: LocalAgenda) {
  const backup = createBackup(state);
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `aura-backup-${backup.exportedAt.replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
