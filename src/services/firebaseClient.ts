import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { getFirebaseApp, readFirebaseConfig } from './firebaseApp';

export { readFirebaseConfig } from './firebaseApp';
let instance: Auth | undefined;
export function getFirebaseAuth(): Auth | null {
  const config = readFirebaseConfig(import.meta.env);
  if (!config) return null;
  if (instance) return instance;
  const app = getFirebaseApp();
  if (!app) return null;
  const auth = getAuth(app);
  auth.languageCode = 'pt-BR';
  const emulator = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL;
  if (import.meta.env.DEV && emulator) {
    const url = new URL(emulator);
    if (
      url.protocol !== 'http:' ||
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !config.projectId?.startsWith('demo-')
    )
      throw new Error('Emulador permitido apenas em localhost com projeto demo.');
    connectAuthEmulator(auth, url.origin, { disableWarnings: true });
  }
  instance = auth;
  return instance;
}
