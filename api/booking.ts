import type { VercelRequest, VercelResponse } from '@vercel/node';
import { body, id, respondError } from '../server/http.js';
import { requirePublicProof, consumeRateLimit, requestOriginHash } from '../server/access.js';
import { getPublicCatalog, getPublicSlots, confirmPublicBooking } from '../server/publicBooking.js';
import { BookingError, type PublicBookingInput } from '../shared/booking.js';
export function createBookingHandler(verify: typeof requirePublicProof = requirePublicProof) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      await verify(req);
      const data = req.method === 'GET' ? req.query : body(req),
        code = id(data.code);
      if (req.method !== 'GET' && req.method !== 'POST')
        throw new BookingError('INVALID_INPUT', 'Método inválido.', 405);
      await consumeRateLimit({
        kind: req.method === 'POST' ? 'write' : 'read',
        originHash: requestOriginHash(req),
        code,
      });
      if (req.method === 'GET' && data.action === 'catalog')
        res.status(200).json(await getPublicCatalog(code));
      else if (req.method === 'GET' && data.action === 'slots')
        res.status(200).json(await getPublicSlots(code, id(data.serviceId), String(data.date)));
      else if (req.method === 'POST') {
        const { action, ...input } = data;
        if (action !== 'confirm') throw new BookingError('INVALID_INPUT', 'Operação inválida.');
        res.status(200).json(await confirmPublicBooking(input as PublicBookingInput));
      } else throw new BookingError('INVALID_INPUT', 'Operação inválida.');
    } catch (error) {
      respondError(res, error);
    }
  };
}
export default createBookingHandler();
