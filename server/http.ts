import type { VercelRequest, VercelResponse } from '@vercel/node';
import { BookingError } from '../shared/booking.js';
export function body(req: VercelRequest, limit = 16384): Record<string, unknown> {
  const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    Buffer.byteLength(JSON.stringify(data)) > limit
  )
    throw new BookingError('INVALID_INPUT', 'Pedido inválido ou muito grande.');
  return data;
}
export function respondError(res: VercelResponse, error: unknown) {
  res.setHeader('Cache-Control', 'no-store');
  const known = error instanceof BookingError;
  res.status(known ? error.status : 503).json({
    code: known ? error.code : 'UNAVAILABLE',
    message: known
      ? error.message
      : 'Não foi possível concluir. Seus dados foram preservados; tente novamente.',
  });
}
export function id(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(value))
    throw new BookingError('INVALID_INPUT', 'Identificador inválido.');
  return value;
}
