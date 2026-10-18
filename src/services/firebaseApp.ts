import { getApps, initializeApp, type FirebaseOptions } from 'firebase/app';

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

export function getFirebaseApp() {
  const config = readFirebaseConfig(import.meta.env);
  if (!config) return null;
  return getApps().find((app) => app.name === 'bela-hora') || initializeApp(config, 'bela-hora');
}
