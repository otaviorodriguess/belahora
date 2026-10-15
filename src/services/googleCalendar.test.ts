import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  appointmentToEvent,
  eventsToSnapshot,
  eventToAppointment,
  listEvents,
  saveGoogleEvent,
} from './googleCalendar';
import { invalidateGoogleSession } from './googleAuth';
import type { Appointment } from '../types';
const a: Appointment = {
  id: 'abc123',
  nomeCliente: 'Maria Silva',
  telefone: '88999999999',
  servico: 'limpeza-pele',
  valor: 100,
  data: '2026-09-25',
  horaInicio: '14:00',
  horaFim: '15:00',
  duracao: 60,
  observacoes: 'Teste',
  createdAt: '',
  updatedAt: '',
};
vi.mock('./googleAuth', () => ({
  getAccessToken: () => 'test-token',
  invalidateGoogleSession: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe('adaptação Google Calendar', () => {
  it('gera evento com fuso e metadados e faz round trip', () => {
    const payload = appointmentToEvent(a);
    expect(payload.start.dateTime).toBe('2026-09-25T17:00:00.000Z');
    const result = eventToAppointment({ id: a.id, ...payload });
    expect(result).toMatchObject({
      nomeCliente: 'Maria Silva',
      servico: 'limpeza-pele',
      valor: 100,
      data: '2026-09-25',
      horaInicio: '14:00',
      horaFim: '15:00',
      duracao: 60,
    });
    expect(payload.description).toContain('Telefone: 88999999999');
  });
  it('preserva reagendamento feito diretamente no Google', () => {
    const payload = appointmentToEvent(a);
    const result = eventToAppointment({
      id: a.id,
      ...payload,
      start: { dateTime: '2026-09-25T18:00:00Z' },
      end: { dateTime: '2026-09-25T19:30:00Z' },
    });
    expect(result).toMatchObject({ horaInicio: '15:00', horaFim: '16:30', duracao: 90 });
  });
  it('separa eventos externos dos financeiros, ignora cancelados e livres', () => {
    const snapshot = eventsToSnapshot([
      { id: 'a', ...appointmentToEvent(a) },
      {
        id: 'holiday',
        summary: 'Feriado',
        start: { date: '2026-09-25' },
        end: { date: '2026-09-26' },
      },
      { id: 'deleted', status: 'cancelled', ...appointmentToEvent(a) },
      {
        id: 'free',
        transparency: 'transparent',
        start: { date: '2026-09-25' },
        end: { date: '2026-09-26' },
      },
    ]);
    expect(snapshot.appointments).toHaveLength(1);
    expect(snapshot.busy).toHaveLength(1);
    expect(snapshot.busy[0].start).toBe('2026-09-25T03:00:00.000Z');
  });
  it('lê todas as páginas retornadas pelo Google', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: 'a', ...appointmentToEvent(a) }],
            nextPageToken: 'second',
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: 'b', ...appointmentToEvent({ ...a, nomeCliente: 'Outra cliente' }) }],
          }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const result = await listEvents('2026-09-01', '2026-10-01');
    expect(result.appointments).toHaveLength(2);
    expect(fetchMock.mock.calls[1][0]).toContain('pageToken=second');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  });
  it('invalida a sessão quando o servidor responde 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    await expect(listEvents('2026-09-01', '2026-10-01')).rejects.toThrow('sessão expirou');
    expect(invalidateGoogleSession).toHaveBeenCalledOnce();
  });
  it('envia ETag e preserva erro de edição concorrente', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 412 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(saveGoogleEvent({ ...a, googleEventId: a.id, etag: 'version-1' })).rejects.toThrow(
      'alterado no Google',
    );
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
    expect(fetchMock.mock.calls[0][1].headers['If-Match']).toBe('version-1');
  });
  it('usa ID estável na criação e horário que atravessa meia-noite bloqueia como reserva', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: a.id, ...appointmentToEvent(a) })));
    vi.stubGlobal('fetch', fetchMock);
    await saveGoogleEvent(a);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).id).toBe(a.id);
    const snapshot = eventsToSnapshot([
      {
        id: 'overnight',
        ...appointmentToEvent(a),
        start: { dateTime: '2026-09-25T23:00:00-03:00' },
        end: { dateTime: '2026-09-26T01:00:00-03:00' },
      },
    ]);
    expect(snapshot.appointments).toHaveLength(0);
    expect(snapshot.busy).toHaveLength(1);
  });
});
