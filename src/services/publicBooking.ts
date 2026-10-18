import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  getToken,
  type AppCheck,
} from 'firebase/app-check';
import { getFirebaseApp } from './firebaseApp';
import type { Catalog, PublicBookingInput, Receipt } from '../../shared/booking';
let check: AppCheck | undefined;
async function headers() {
  const app = getFirebaseApp(),
    siteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
  if (!app || !siteKey)
    throw new Error('O agendamento online ainda não foi ativado. Fale com a profissional.');
  check ??= initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  return {
    'Content-Type': 'application/json',
    'X-Firebase-AppCheck': (await getToken(check)).token,
  };
}
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: await headers(),
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.message || 'Não foi possível concluir. Tente novamente.');
  return value;
}
export const publicCatalog = (code: string) =>
  request<Catalog>(`/api/booking?action=catalog&code=${encodeURIComponent(code)}`);
export const publicSlots = (code: string, serviceId: string, date: string) =>
  request<string[]>(
    `/api/booking?action=slots&code=${encodeURIComponent(code)}&serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}`,
  );
export const publicConfirm = (input: PublicBookingInput) =>
  request<Receipt>('/api/booking', { action: 'confirm', ...input });
