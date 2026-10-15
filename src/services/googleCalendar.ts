import { formatInTimeZone } from 'date-fns-tz';
import type { Appointment, ScheduleSnapshot } from '../types';
import { getAccessToken, invalidateGoogleSession } from './googleAuth';
import { serviceName } from '../data/services';
import { instant, money, TIME_ZONE } from '../utils/dates';
export interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  status?: string;
  transparency?: string;
  etag?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  created?: string;
  updated?: string;
  extendedProperties?: { private?: Record<string, string> };
}
const BASE = 'https://www.googleapis.com/calendar/v3';
let calendarId = import.meta.env.VITE_GOOGLE_CALENDAR_ID || 'primary';
function url(path: string) {
  return `${BASE}/calendars/${encodeURIComponent(calendarId)}${path}`;
}
async function request<T>(target: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(target, {
    ...options,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) {
    if (response.status === 401) {
      invalidateGoogleSession();
      throw new Error('Sua sessão expirou. Conecte o Google Agenda novamente.');
    }
    if (response.status === 403)
      throw new Error(
        'O Google negou o acesso. Verifique as permissões da agenda e se a Calendar API está ativada.',
      );
    if (response.status === 412)
      throw new Error(
        'Este agendamento foi alterado no Google. Sincronize a agenda antes de editar novamente.',
      );
    if (response.status === 409)
      throw new Error(
        'Este agendamento já foi recebido pelo Google. Sincronize antes de tentar novamente.',
      );
    if (response.status === 404 || response.status === 410)
      throw new Error('O evento ou a agenda não existe mais. Sincronize para atualizar.');
    if (response.status === 429)
      throw new Error('Muitas solicitações ao Google. Aguarde um momento e tente novamente.');
    throw new Error(
      `Não foi possível concluir a operação no Google (${response.status}). Tente sincronizar novamente.`,
    );
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
export async function resolveCalendar() {
  calendarId = import.meta.env.VITE_GOOGLE_CALENDAR_ID || 'primary';
  const calendar = await request<{ id: string; summary: string }>(url(''));
  calendarId = calendar.id;
  return calendar;
}
export function eventToAppointment(event: GoogleEvent): Appointment | null {
  const meta = event.extendedProperties?.private;
  if (
    meta?.auraApp !== '1' ||
    !event.start?.dateTime ||
    !event.end?.dateTime ||
    event.status === 'cancelled'
  )
    return null;
  const duration = Math.round(
    (Date.parse(event.end.dateTime) - Date.parse(event.start.dateTime)) / 60000,
  );
  // Google is the source of truth for dates, even when edited outside Aura.
  if (
    duration <= 0 ||
    duration > 1440 ||
    formatInTimeZone(event.start.dateTime, TIME_ZONE, 'yyyy-MM-dd') !==
      formatInTimeZone(event.end.dateTime, TIME_ZONE, 'yyyy-MM-dd')
  )
    return null;
  return {
    id: event.id,
    googleEventId: event.id,
    nomeCliente: meta.nomeCliente || event.summary || 'Cliente',
    telefone: meta.telefone || '',
    servico: meta.servico || 'Atendimento',
    valor: Number.isFinite(Number(meta.valor)) ? Number(meta.valor) : 0,
    data: formatInTimeZone(event.start.dateTime, TIME_ZONE, 'yyyy-MM-dd'),
    horaInicio: formatInTimeZone(event.start.dateTime, TIME_ZONE, 'HH:mm'),
    horaFim: formatInTimeZone(event.end.dateTime, TIME_ZONE, 'HH:mm'),
    duracao: duration,
    observacoes: meta.observacoes || '',
    createdAt: event.created || '',
    updatedAt: event.updated || '',
    etag: event.etag,
  };
}
export function eventsToSnapshot(events: GoogleEvent[]): ScheduleSnapshot {
  const snapshot: ScheduleSnapshot = {
    appointments: [],
    busy: [],
    syncedAt: new Date().toISOString(),
  };
  for (const event of events) {
    if (event.status === 'cancelled') continue;
    const appointment = eventToAppointment(event);
    if (appointment) {
      snapshot.appointments.push(appointment);
      continue;
    }
    if (event.transparency === 'transparent') continue;
    const start =
      event.start?.dateTime || (event.start?.date ? instant(event.start.date, '00:00') : undefined);
    const end =
      event.end?.dateTime || (event.end?.date ? instant(event.end.date, '00:00') : undefined);
    if (start && end)
      snapshot.busy.push({ id: event.id, title: event.summary || 'Horário ocupado', start, end });
  }
  return snapshot;
}
export async function listEvents(start: string, end: string): Promise<ScheduleSnapshot> {
  const all: GoogleEvent[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      timeMin: instant(start, '00:00'),
      timeMax: instant(end, '00:00'),
      singleEvents: 'true',
      showDeleted: 'false',
      maxResults: '2500',
      orderBy: 'startTime',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const result = await request<{ items?: GoogleEvent[]; nextPageToken?: string }>(
      url(`/events?${params}`),
    );
    all.push(...(result.items || []));
    pageToken = result.nextPageToken;
  } while (pageToken);
  return eventsToSnapshot(all);
}
export function appointmentToEvent(a: Appointment) {
  return {
    summary: `${a.nomeCliente} - ${serviceName(a.servico, a.servicos, a.serviceNames)}`,
    description: `Cliente: ${a.nomeCliente}\nTelefone: ${a.telefone || 'Não informado'}\nProcedimento: ${serviceName(a.servico, a.servicos, a.serviceNames)}\nValor: ${money(a.valor)}\nObservações: ${a.observacoes || 'Nenhuma'}`,
    start: { dateTime: instant(a.data, a.horaInicio), timeZone: TIME_ZONE },
    end: { dateTime: instant(a.data, a.horaFim), timeZone: TIME_ZONE },
    transparency: 'opaque',
    extendedProperties: {
      private: {
        auraApp: '1',
        nomeCliente: a.nomeCliente,
        telefone: a.telefone,
        servico: a.servico,
        valor: String(a.valor),
        observacoes: a.observacoes,
      },
    },
  };
}
export async function saveGoogleEvent(a: Appointment): Promise<Appointment> {
  const editing = Boolean(a.googleEventId);
  const event = await request<GoogleEvent>(
    url(editing ? `/events/${encodeURIComponent(a.googleEventId!)}` : '/events'),
    {
      method: editing ? 'PATCH' : 'POST',
      headers: editing && a.etag ? { 'If-Match': a.etag } : {},
      body: JSON.stringify({ ...appointmentToEvent(a), ...(!editing ? { id: a.id } : {}) }),
    },
  );
  const parsed = eventToAppointment(event);
  if (!parsed) throw new Error('O Google retornou um evento inesperado. Sincronize a agenda.');
  return parsed;
}
export async function deleteGoogleEvent(a: Appointment) {
  await request<void>(url(`/events/${encodeURIComponent(a.googleEventId!)}`), {
    method: 'DELETE',
    headers: a.etag ? { 'If-Match': a.etag } : {},
  });
}

