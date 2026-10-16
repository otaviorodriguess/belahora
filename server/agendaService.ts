import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { validateBrandImage } from '../shared/branding.js';
import type { AppointmentInput, Settings } from '../src/types/index.js';
import {
  canonical,
  BookingError,
  type CloudAppointment,
  type Command,
  type Occupancy,
  type PublicBookingInput,
} from '../shared/booking.js';
import {
  assertSchedule,
  assertFree,
  mins,
  clock,
  calculatePublicSlots,
} from '../shared/scheduling.js';
import { adminDb } from './firebaseAdmin.js';
import { id } from './http.js';
export const hash = (data: unknown) => createHash('sha256').update(canonical(data)).digest('hex');
export function cleanInput(input: AppointmentInput): AppointmentInput {
  if (
    !input ||
    typeof input.nomeCliente !== 'string' ||
    !input.nomeCliente.trim() ||
    input.nomeCliente.length > 100 ||
    typeof input.telefone !== 'string' ||
    (input.telefone && !/^(?:55)?\d{10,11}$/.test(input.telefone.replace(/\D/g, ''))) ||
    !Number.isFinite(input.valor) ||
    input.valor < 0 ||
    input.valor > 100000 ||
    typeof input.observacoes !== 'string' ||
    input.observacoes.length > 5000
  )
    throw new BookingError('INVALID_INPUT', 'Confira nome, telefone, valor e observações.');
  if (
    typeof input.servico !== 'string' ||
    input.servico.length > 160 ||
    (input.servicos &&
      (!Array.isArray(input.servicos) ||
        input.servicos.length > 30 ||
        input.servicos.some((s) => typeof s !== 'string' || s.length > 160))) ||
    (input.serviceNames &&
      (!Array.isArray(input.serviceNames) ||
        input.serviceNames.length > 30 ||
        input.serviceNames.some((s) => typeof s !== 'string' || s.length > 160)))
  )
    throw new BookingError('INVALID_INPUT', 'Serviço inválido.');
  return JSON.parse(
    JSON.stringify({
      nomeCliente: input.nomeCliente.trim(),
      telefone: input.telefone,
      servico: input.servico,
      servicos: input.servicos,
      serviceNames: input.serviceNames,
      valor: input.valor,
      data: input.data,
      horaInicio: input.horaInicio,
      horaFim: clock(mins(input.horaInicio) + input.duracao),
      duracao: input.duracao,
      observacoes: input.observacoes,
    }),
  );
}
export function validateSettings(s: Settings) {
  let professionalPhoto: string | undefined, studioLogo: string | undefined;
  try {
    professionalPhoto = validateBrandImage(s?.professionalPhoto);
    studioLogo = validateBrandImage(s?.studioLogo);
  } catch (error) {
    throw new BookingError('INVALID_INPUT', error instanceof Error ? error.message : 'Imagem inválida.');
  }
  if (
    !s ||
    typeof s.studio !== 'string' ||
    !s.studio.trim() ||
    s.studio.length > 100 ||
    typeof s.professional !== 'string' ||
    s.professional.length > 100 ||
    !Number.isInteger(s.gap) ||
    s.gap < 0 ||
    s.gap > 120 ||
    !Array.isArray(s.hours) ||
    s.hours.length !== 7 ||
    s.hours.some(
      (h) =>
        typeof h.active !== 'boolean' ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.start) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.end) ||
        h.start >= h.end,
    )
  )
    throw new BookingError('INVALID_INPUT', 'Configurações inválidas.');
  if (
    !Array.isArray(s.services) ||
    s.services.length > 100 ||
    new Set(s.services.map((x) => x.id)).size !== s.services.length ||
    s.services.some(
      (x) =>
        !x.id ||
        typeof x.nome !== 'string' ||
        !x.nome.trim() ||
        x.nome.length > 100 ||
        !Number.isFinite(x.preco) ||
        x.preco < 0 ||
        x.preco > 100000 ||
        !Number.isInteger(x.duracao) ||
        x.duracao < 5 ||
        x.duracao > 720,
    )
  )
    throw new BookingError('INVALID_INPUT', 'Confira os serviços.');
  return JSON.parse(
    JSON.stringify({ ...s, professionalPhoto, studioLogo, mode: 'local', cachedCalendarId: undefined }),
  ) as Settings;
}
export async function mutateAppointment(
  uid: string,
  command: Command,
  publicInput?: PublicBookingInput,
): Promise<CloudAppointment> {
  const db = adminDb(),
    account = db.doc(`accounts/${id(uid)}`),
    operation = account.collection('operations').doc(id(command.operationId));
  if (!['create', 'update', 'cancel'].includes(command.kind))
    throw new BookingError('INVALID_INPUT', 'Operação inválida.');
  const appointmentId = command.kind === 'create' ? randomUUID() : id(command.id),
    ref = account.collection('appointments').doc(appointmentId);
  const requestHash = hash(publicInput || command);
  return db.runTransaction(
    async (tx) => {
      const [acc, op, previous] = await tx.getAll(account, operation, ref);
      if (op.exists) {
        if (op.data()!.hash !== requestHash)
          throw new BookingError('CONFLICT', 'Pedido já utilizado com outros dados.', 409);
        return op.data()!.result as CloudAppointment;
      }
      if (!acc.exists || !acc.data()!.migrationReady)
        throw new BookingError(
          'MIGRATION_REQUIRED',
          'Conclua a importação da agenda antes de alterar.',
          409,
        );
      const settings = acc.data()!.settings as Settings;
      let input: AppointmentInput | undefined =
        command.kind === 'cancel' ? undefined : command.input;
      if (publicInput) {
        if (!acc.data()!.publicEnabled || acc.data()!.linkCode !== publicInput.code)
          throw new BookingError('LINK_PAUSED', 'Este link não está recebendo agendamentos.', 409);
        const service = settings.services?.find(
          (s) => s.id === publicInput.serviceId && s.active !== false,
        );
        if (!service) throw new BookingError('INVALID_INPUT', 'Este serviço não está disponível.');
        input = {
          nomeCliente: publicInput.name,
          telefone: publicInput.phone,
          servico: service.id,
          serviceNames: [service.nome],
          valor: service.preco,
          data: publicInput.date,
          horaInicio: publicInput.start,
          horaFim: '',
          duracao: service.duracao,
          observacoes: '',
        };
      }
      if (
        command.kind !== 'create' &&
        (!previous.exists ||
          previous.data()!.revision !== command.expectedRevision ||
          previous.data()!.status === 'cancelled')
      )
        throw new BookingError(
          'STALE_REVISION',
          'Este atendimento mudou. Atualize antes de editar.',
          409,
        );
      const old = previous.data() as CloudAppointment | undefined;
      const value = input ? cleanInput(input) : undefined;
      if (value) assertSchedule(value.data, value.horaInicio, value.duracao, settings);
      const dates = [...new Set([old?.value.data, value?.data].filter(Boolean) as string[])];
      const dayRefs = dates.map((d) => account.collection('days').doc(d));
      const dayDocs = await tx.getAll(...dayRefs);
      const occupancy = dayDocs.map((d) => (d.data()?.occupancy || []) as Occupancy[]);
      if (value) {
        const occupied = occupancy[dates.indexOf(value.data)];
        assertFree({
          startMinute: mins(value.horaInicio),
          endMinute: mins(value.horaFim),
          gap: settings.gap,
          occupancy: occupied,
          ignoreId: appointmentId,
        });
        if (
          publicInput &&
          !calculatePublicSlots({
            date: value.data,
            duration: value.duracao,
            settings,
            occupancy: occupied,
            nowMs: Date.now(),
          }).includes(value.horaInicio)
        )
          throw new BookingError('CONFLICT', 'Este horário não está mais disponível.', 409);
      }
      const now = new Date().toISOString();
      const result: CloudAppointment = {
        value: value
          ? {
              ...value,
              id: appointmentId,
              createdAt: old?.value.createdAt || now,
              updatedAt: now,
              etag: randomUUID(),
            }
          : old!.value,
        revision: (old?.revision || 0) + 1,
        status: command.kind === 'cancel' ? 'cancelled' : 'confirmed',
        origin: old?.origin || (publicInput ? 'public' : 'owner'),
      };
      dates.forEach((date, i) => {
        const entries = occupancy[i].filter((o) => o.appointmentId !== appointmentId);
        if (value?.data === date)
          entries.push({
            appointmentId,
            startMinute: mins(value.horaInicio),
            endMinute: mins(value.horaFim),
          });
        if (Buffer.byteLength(JSON.stringify(entries)) > 512 * 1024)
          throw new BookingError('UNAVAILABLE', 'Este dia atingiu o limite de registros.', 409);
        tx.set(dayRefs[i], { occupancy: entries });
      });
      tx.set(ref, result);
      tx.set(operation, { hash: requestHash, result });
      return result;
    },
    { maxAttempts: 30 },
  );
}
export async function updateSettings(
  uid: string,
  settings: Settings,
  revision: number,
  operationId: string,
) {
  const db = adminDb(),
    ref = db.doc(`accounts/${id(uid)}`),
    op = ref.collection('operations').doc(id(operationId)),
    value = validateSettings(settings),
    digest = hash({ value, revision });
  await db.runTransaction(async (tx) => {
    const [doc, previous] = await tx.getAll(ref, op);
    if (previous.exists) {
      if (previous.data()!.hash !== digest)
        throw new BookingError('CONFLICT', 'Pedido alterado.', 409);
      return;
    }
    if (!doc.exists || !doc.data()!.migrationReady || doc.data()!.settingsRevision !== revision)
      throw new BookingError(
        'STALE_REVISION',
        'As configurações mudaram. Atualize e tente novamente.',
        409,
      );
    tx.update(ref, { settings: value, settingsRevision: revision + 1 });
    tx.set(op, { hash: digest });
  });
}
export async function setBookingEnabled(uid: string, enabled: boolean, revision: number) {
  const db = adminDb(),
    ref = db.doc(`accounts/${id(uid)}`);
  const newCode = randomBytes(16).toString('hex');
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists || !doc.data()!.migrationReady || doc.data()!.settingsRevision !== revision)
      throw new BookingError('MIGRATION_REQUIRED', 'Confira a migração e atualize a agenda.', 409);
    const code = doc.data()!.linkCode || newCode;
    const link = db.doc(`bookingLinks/${code}`);
    const existing = await tx.get(link);
    if (existing.exists && existing.data()!.uid !== uid)
      throw new BookingError('CONFLICT', 'Tente novamente.', 409);
    tx.set(link, { uid });
    tx.update(ref, { publicEnabled: enabled, linkCode: code });
    return { code, enabled };
  });
}
