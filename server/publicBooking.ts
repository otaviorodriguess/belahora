import type { AppointmentInput, Settings } from '../src/types/index.js';
import {
  BookingError,
  type Catalog,
  type PublicBookingInput,
  type Receipt,
} from '../shared/booking.js';
import { adminDb } from './firebaseAdmin.js';
import { id } from './http.js';
import { calculatePublicSlots, validDate } from '../shared/scheduling.js';
import { mutateAppointment } from './agendaService.js';
async function accountFor(code: string, requireActive = true) {
  const db = adminDb(),
    link = await db.doc(`bookingLinks/${id(code)}`).get();
  if (!link.exists)
    throw new BookingError('LINK_PAUSED', 'Link indisponível. Fale com a profissional.', 404);
  const uid = link.data()!.uid as string,
    account = await db.doc(`accounts/${uid}`).get();
  if (requireActive && (!account.data()?.publicEnabled || !account.data()?.migrationReady))
    throw new BookingError(
      'LINK_PAUSED',
      'A agenda não está recebendo novas reservas neste momento.',
      409,
    );
  return { uid, settings: account.data()!.settings as Settings };
}
export async function getPublicCatalog(code: string): Promise<Catalog> {
  const { settings } = await accountFor(code);
  return {
    studio: settings.studio,
    professional: settings.professional,
    services: (settings.services || [])
      .filter((s) => s.active !== false)
      .map(({ id, nome, preco, duracao }) => ({ id, nome, preco, duracao })),
  };
}
export async function getPublicSlots(
  code: string,
  serviceId: string,
  date: string,
  nowMs = Date.now(),
) {
  const { uid, settings } = await accountFor(code);
  if (!validDate(date)) throw new BookingError('INVALID_INPUT', 'Data inválida.');
  const service = settings.services?.find((s) => s.id === serviceId && s.active !== false);
  if (!service) throw new BookingError('INVALID_INPUT', 'Serviço indisponível.');
  const day = await adminDb().doc(`accounts/${uid}/days/${date}`).get();
  return calculatePublicSlots({
    date,
    duration: service.duracao,
    settings,
    occupancy: day.data()?.occupancy || [],
    nowMs,
  });
}
export async function confirmPublicBooking(input: PublicBookingInput): Promise<Receipt> {
  if (
    !input ||
    Object.keys(input).some(
      (k) => !['code', 'serviceId', 'date', 'start', 'name', 'phone', 'operationId'].includes(k),
    ) ||
    typeof input.name !== 'string' ||
    typeof input.phone !== 'string' ||
    !/^(?:55)?\d{10,11}$/.test(input.phone.replace(/\D/g, ''))
  )
    throw new BookingError('INVALID_INPUT', 'Informe nome e telefone com DDD.');
  const { uid } = await accountFor(input.code, false);
  const result = await mutateAppointment(
    uid,
    { kind: 'create', input: {} as AppointmentInput, operationId: id(input.operationId) },
    input,
  );
  const a = result.value;
  return {
    reference: a.id,
    serviceName: a.serviceNames?.[0] || a.servico,
    date: a.data,
    start: a.horaInicio,
    end: a.horaFim,
    price: a.valor,
  };
}
