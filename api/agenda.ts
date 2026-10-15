import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Settings, Appointment, AppointmentInput } from '../src/types/index.js';
import type { Command } from '../shared/booking.js';
import { BookingError } from '../shared/booking.js';
import { requireOwner } from '../server/access.js';
import { body, id, respondError } from '../server/http.js';
import { mutateAppointment, updateSettings, setBookingEnabled } from '../server/agendaService.js';
import {
  startImport,
  importRecords,
  completeImport,
  resolveImport,
  type Manifest,
} from '../server/importService.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') throw new BookingError('INVALID_INPUT', 'Método inválido.', 405);
    const { uid } = await requireOwner(req),
      data = body(req, 512 * 1024);
    let result: unknown = { ok: true };
    switch (data.action) {
      case 'mutate':
        result = await mutateAppointment(uid, data.command as Command);
        break;
      case 'settings':
        await updateSettings(
          uid,
          data.settings as Settings,
          Number(data.revision),
          id(data.operationId),
        );
        break;
      case 'link':
        if (typeof data.enabled !== 'boolean')
          throw new BookingError('INVALID_INPUT', 'Configuração inválida.');
        result = await setBookingEnabled(uid, data.enabled, Number(data.revision));
        break;
      case 'import-start':
        result = { complete: await startImport(uid, data.manifest as Manifest) };
        break;
      case 'import-records':
        await importRecords(uid, id(data.batchId), data.records as Appointment[]);
        break;
      case 'import-complete':
        await completeImport(uid, id(data.batchId));
        break;
      case 'import-resolve':
        await resolveImport(
          uid,
          id(data.batchId),
          id(data.itemId),
          data.corrected as AppointmentInput | undefined,
        );
        break;
      default:
        throw new BookingError('INVALID_INPUT', 'Operação inválida.');
    }
    res.status(200).json(result);
  } catch (error) {
    respondError(res, error);
  }
}
