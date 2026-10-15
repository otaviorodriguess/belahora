import { getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';

export function readFirebaseConfig(env: Record<string, unknown>): FirebaseOptions | null {
  const enabled = env.VITE_AUTH_ENABLED;
  if (enabled === undefined || enabled === '' || enabled === 'false') return null;
  if (enabled !== 'true')
    throw new Error('Configuração de login inválida. Confira VITE_AUTH_ENABLED.');
  const fields = {
    apiKey: 'VITE_FIREBASE_API_KEY',
    authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
    projectId: 'VITE_FIREBASE_PROJECT_ID',
    appId: 'VITE_FIREBASE_APP_ID',
  };
  const config: Record<string, string> = {};
  for (const [key, name] of Object.entries(fields)) {
    const value = env[name];
    if (typeof value !== 'string' || !value.trim())
      throw new Error(
        'O login ainda não foi configurado. Entre em contato com quem administra a agenda.',
      );
    config[key] = value.trim();
  }
  return config;
}
let instance: Auth | undefined;
export function getFirebaseAuth(): Auth | null {
  const config = readFirebaseConfig(import.meta.env);
  if (!config) return null;
  if (instance) return instance;
  const app = getApps().find((a) => a.name === 'bela-hora') || initializeApp(config, 'bela-hora');
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
