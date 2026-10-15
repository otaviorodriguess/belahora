import { getAuth } from 'firebase-admin/auth';
import { getAppCheck } from 'firebase-admin/app-check';
import { createHmac } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import { adminApp, adminDb } from './firebaseAdmin.js';
import { BookingError } from '../shared/booking.js';
export async function requireOwner(req: VercelRequest) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new BookingError('UNAUTHENTICATED', 'Entre novamente na sua conta.', 401);
  let uid: string;
  try {
    const identity = await getAuth(adminApp()).verifyIdToken(token, true);
    uid = identity.uid;
  } catch {
    throw new BookingError('UNAUTHENTICATED', 'Entre novamente na sua conta.', 401);
  }
  const account = await adminDb().doc(`accounts/${uid}`).get();
  if (account.data()?.readOnly === true)
    throw new BookingError('READ_ONLY', 'Conta de demonstração: somente leitura.', 403);
  return { uid };
}
export async function requirePublicProof(req: VercelRequest) {
  const token = req.headers['x-firebase-appcheck'];
  if (typeof token !== 'string')
    throw new BookingError(
      'FORBIDDEN',
      'Não foi possível validar seu acesso. Recarregue a página.',
      403,
    );
  try {
    await getAppCheck(adminApp()).verifyToken(token);
  } catch {
    throw new BookingError(
      'FORBIDDEN',
      'Não foi possível validar seu acesso. Recarregue a página.',
      403,
    );
  }
}
export async function consumeRateLimit({
  kind,
  originHash,
  code,
  nowMs = Date.now(),
}: {
  kind: 'read' | 'write';
  originHash: string;
  code: string;
  nowMs?: number;
}) {
  const db = adminDb();
  const window = kind === 'write' ? 600000 : 60000;
  const keys = [
    {
      key: `${kind}:${originHash}:${Math.floor(nowMs / window)}`,
      max: kind === 'write' ? 10 : 120,
    },
    { key: `${kind}:${code}:${Math.floor(nowMs / 60000)}`, max: kind === 'write' ? 60 : 300 },
  ];
  await db.runTransaction(async (tx) => {
    const refs = keys.map((k) =>
      db.collection('_limits').doc(createHmac('sha256', 'limit-key').update(k.key).digest('hex')),
    );
    const docs = await tx.getAll(...refs);
    if (docs.some((d, i) => (d.data()?.count || 0) >= keys[i].max))
      throw new BookingError('RATE_LIMITED', 'Muitas tentativas. Aguarde alguns minutos.', 429);
    refs.forEach((ref, i) =>
      tx.set(ref, {
        count: (docs[i].data()?.count || 0) + 1,
        expiresAt: new Date(nowMs + 86400000),
      }),
    );
  });
}
export function requestOriginHash(req: VercelRequest) {
  const secret = process.env.BOOKING_RATE_SECRET;
  if (!secret) throw new Error('Rate limiter not configured');
  const ip = req.headers['x-vercel-forwarded-for'];
  if (typeof ip !== 'string')
    throw new BookingError('UNAVAILABLE', 'Serviço temporariamente indisponível.', 503);
  return createHmac('sha256', secret).update(ip.split(',')[0].trim()).digest('hex');
}
