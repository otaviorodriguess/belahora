import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
export function adminApp() {
  const existing = getApps().find((a) => a.name === 'booking');
  if (existing) return existing;
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  if (emulator) {
    if (
      emulator !== '127.0.0.1:8080' ||
      process.env.GCLOUD_PROJECT !== 'demo-belahora' ||
      process.env.VERCEL
    )
      throw new Error('Unsafe emulator configuration');
    return initializeApp({ projectId: 'demo-belahora' }, 'booking');
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Cloud credentials not configured');
  return initializeApp({ credential: cert(JSON.parse(raw)), projectId: 'belahora' }, 'booking');
}
export const adminDb = () => getFirestore(adminApp());
