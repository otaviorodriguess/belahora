import type { Appointment, AppointmentInput, Settings } from '../src/types/index.js';
import { randomUUID } from 'node:crypto';
import { BookingError, type CloudAppointment, type Occupancy } from '../shared/booking.js';
import { validDate, mins, assertFree, assertSchedule } from '../shared/scheduling.js';
import { adminDb } from './firebaseAdmin.js';
import { hash, validateSettings, cleanInput } from './agendaService.js';
import { id } from './http.js';
function contentHash(value: Appointment) {
  const content = { ...value };
  delete content.etag;
  return hash(content);
}
export type Manifest = { batchId: string; count: number; root: string; settings: Settings };
export async function startImport(uid: string, m: Manifest) {
  const db = adminDb(),
    a = db.doc(`accounts/${id(uid)}`),
    batch = a.collection('imports').doc(id(m.batchId));
  if (
    !Number.isInteger(m.count) ||
    m.count < 0 ||
    m.count > 20000 ||
    !/^[a-f0-9]{64}$/.test(m.root)
  )
    throw new BookingError('INVALID_INPUT', 'Lote inválido.');
  const settings = validateSettings(m.settings);
  return db.runTransaction(async (tx) => {
    const [acc, existing] = await tx.getAll(a, batch);
    if (existing.exists) {
      if (existing.data()!.root !== m.root || existing.data()!.count !== m.count)
        throw new BookingError('CONFLICT', 'Lote alterado.', 409);
      return existing.data()!.complete === true;
    }
    if (acc.data()?.activeBatch)
      throw new BookingError('CONFLICT', 'Conclua a importação pendente nas configurações.', 409);
    if (!acc.exists)
      tx.set(a, {
        settings,
        settingsRevision: 1,
        migrationReady: false,
        publicEnabled: false,
        linkCode: null,
        activeBatch: m.batchId,
      });
    else {
      // A new phone may initialize the account before the phone holding the old catalog.
      // Only adopt that catalog while cloud settings are still untouched and empty.
      const recoverCatalog =
        acc.data()!.settingsRevision === 1 &&
        acc.data()!.settings.services?.length === 0 &&
        settings.services!.length > 0;
      tx.update(a, {
        migrationReady: false,
        publicEnabled: false,
        activeBatch: m.batchId,
        ...(recoverCatalog ? { settings, settingsRevision: 2 } : {}),
      });
    }
    tx.set(batch, {
      root: m.root,
      count: m.count,
      settings,
      complete: false,
      createdAt: new Date().toISOString(),
    });
    return false;
  });
}
export async function importRecords(uid: string, batchId: string, values: Appointment[]) {
  if (!Array.isArray(values) || values.length > 50)
    throw new BookingError('INVALID_INPUT', 'Lote muito grande.');
  const db = adminDb(),
    a = db.doc(`accounts/${id(uid)}`),
    batch = a.collection('imports').doc(id(batchId));
  for (const value of values) {
    const key = id(value.id),
      item = batch.collection('items').doc(key),
      appointment = a.collection('appointments').doc(key),
      digest = hash(value);
    await db.runTransaction(async (tx) => {
      const [acc, b, already, old] = await tx.getAll(a, batch, item, appointment);
      if (already.exists) {
        if (already.data()!.hash !== digest)
          throw new BookingError('CONFLICT', 'Registro do lote foi alterado.', 409);
        return;
      }
      if (!b.exists || b.data()!.complete || acc.data()?.activeBatch !== batchId)
        throw new BookingError('CONFLICT', 'Importação não está ativa.', 409);
      let reason = '';
      const prior = old.data() as CloudAppointment | undefined;
      if (prior) {
        if (prior.status === 'cancelled') reason = 'Este atendimento foi cancelado na nuvem.';
        else if (contentHash(prior.value) !== contentHash(value))
          reason = 'Há outra versão deste atendimento na nuvem.';
      }
      const valid =
        validDate(value.data) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(value.horaInicio) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(value.horaFim) &&
        mins(value.horaFim) > mins(value.horaInicio) &&
        Number.isFinite(value.valor) &&
        typeof value.nomeCliente === 'string';
      if (!valid) reason = 'Confira o formato dos dados antigos.';
      const day = valid ? a.collection('days').doc(value.data) : null;
      const occupied = day ? (await tx.get(day)).data()?.occupancy || [] : [];
      if (!prior && !reason) {
        try {
          assertFree({
            startMinute: mins(value.horaInicio),
            endMinute: mins(value.horaFim),
            gap: acc.data()!.settings.gap,
            occupancy: occupied as Occupancy[],
          });
        } catch {
          reason = 'Existe outro atendimento neste intervalo.';
        }
      }
      const next = [
        ...occupied,
        { appointmentId: key, startMinute: mins(value.horaInicio), endMinute: mins(value.horaFim) },
      ];
      if (!prior && !reason && Buffer.byteLength(JSON.stringify(next)) > 512 * 1024)
        reason = 'Dia atingiu o limite de registros.';
      tx.set(item, {
        hash: digest,
        status: reason ? 'conflict' : prior ? 'identical' : 'imported',
        reason,
        value,
      });
      if (!reason && !prior) {
        tx.set(appointment, { value, revision: 1, status: 'confirmed', origin: 'import' });
        tx.set(day!, { occupancy: next });
      }
    });
  }
}
export async function completeImport(uid: string, batchId: string) {
  const db = adminDb(),
    a = db.doc(`accounts/${id(uid)}`),
    batch = a.collection('imports').doc(id(batchId));
  return db.runTransaction(async (tx) => {
    const [acc, b] = await tx.getAll(a, batch);
    if (!b.exists) throw new BookingError('INVALID_INPUT', 'Importação não encontrada.');
    if (b.data()!.complete) return;
    if (acc.data()?.activeBatch !== batchId)
      throw new BookingError('CONFLICT', 'Outro lote está ativo.', 409);
    const items = await tx.get(batch.collection('items'));
    if (
      items.size !== b.data()!.count ||
      hash(items.docs.map((d) => [d.id, d.data().hash]).sort(([a], [b]) => a.localeCompare(b))) !==
        b.data()!.root
    )
      throw new BookingError('CONFLICT', 'Ainda faltam dados para concluir a importação.', 409);
    if (items.docs.some((d) => d.data().status === 'conflict'))
      throw new BookingError(
        'CONFLICT',
        'Há registros para conferir nas configurações. As cópias foram preservadas.',
        409,
      );
    tx.update(batch, { complete: true });
    tx.update(a, { migrationReady: true, activeBatch: null });
  });
}
export async function resolveImport(
  uid: string,
  batchId: string,
  itemId: string,
  corrected?: AppointmentInput,
) {
  const db = adminDb(),
    a = db.doc(`accounts/${id(uid)}`),
    item = a.collection('imports').doc(id(batchId)).collection('items').doc(id(itemId));
  await db.runTransaction(async (tx) => {
    const [acc, record] = await tx.getAll(a, item);
    if (acc.data()?.activeBatch !== batchId || record.data()?.status !== 'conflict')
      throw new BookingError('CONFLICT', 'A pendência mudou.', 409);
    let replacementId: string | null = null;
    if (corrected) {
      const value = cleanInput(corrected),
        settings = acc.data()!.settings as Settings;
      assertSchedule(value.data, value.horaInicio, value.duracao, settings);
      const day = a.collection('days').doc(value.data),
        saved = await tx.get(day);
      const occupancy = (saved.data()?.occupancy || []) as Occupancy[];
      assertFree({
        startMinute: mins(value.horaInicio),
        endMinute: mins(value.horaFim),
        gap: settings.gap,
        occupancy,
      });
      replacementId = randomUUID();
      const next = [
        ...occupancy,
        {
          appointmentId: replacementId,
          startMinute: mins(value.horaInicio),
          endMinute: mins(value.horaFim),
        },
      ];
      if (Buffer.byteLength(JSON.stringify(next)) > 512 * 1024)
        throw new BookingError('CONFLICT', 'Este dia atingiu o limite de registros.', 409);
      const now = new Date().toISOString();
      tx.set(a.collection('appointments').doc(replacementId), {
        value: { ...value, id: replacementId, createdAt: now, updatedAt: now, etag: randomUUID() },
        revision: 1,
        status: 'confirmed',
        origin: 'import',
      });
      tx.set(day, { occupancy: next });
    }
    tx.update(item, {
      status: 'resolved',
      resolution: corrected ? 'corrected-copy' : 'kept-cloud',
      replacementId,
      resolvedAt: new Date().toISOString(),
    });
  });
}
