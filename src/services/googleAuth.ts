interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}
interface GoogleIdentity {
  accounts: {
    oauth2: {
      initTokenClient: (options: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback: (error: { type: string }) => void;
      }) => { requestAccessToken: (options: { prompt: string }) => void };
      revoke: (token: string, callback: () => void) => void;
    };
  };
}
declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}
let accessToken = '';
let expiresAt = 0;
let loading: Promise<void> | undefined;
export const googleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
export const hasGoogleSession = () => Boolean(accessToken && Date.now() < expiresAt);
export function invalidateGoogleSession() {
  accessToken = '';
  expiresAt = 0;
}
export function getAccessToken() {
  if (!hasGoogleSession())
    throw new Error('Sua sessão expirou. Conecte o Google Agenda novamente.');
  return accessToken;
}
export function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts.oauth2) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const timeout = window.setTimeout(() => {
      script.remove();
      reject(new Error('Não foi possível carregar o Google. Verifique sua conexão.'));
    }, 15000);
    script.onload = () => {
      clearTimeout(timeout);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timeout);
      script.remove();
      reject(new Error('Não foi possível carregar o Google. Verifique sua conexão.'));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
export async function connectGoogle(): Promise<void> {
  if (!googleConfigured)
    throw new Error(
      'Configure VITE_GOOGLE_CLIENT_ID no arquivo .env e reinicie o aplicativo. Veja o README.',
    );
  await loadGoogleIdentity();
  await new Promise<void>((resolve, reject) => {
    window
      .google!.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope:
          'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendars.readonly',
        callback: (response) => {
          if (!response.access_token || response.error) {
            reject(
              new Error(response.error_description || 'O acesso à agenda não foi autorizado.'),
            );
            return;
          }
          accessToken = response.access_token;
          expiresAt = Date.now() + (Number(response.expires_in || 3600) - 60) * 1000;
          resolve();
        },
        error_callback: () =>
          reject(new Error('A conexão foi interrompida. Permita o pop-up e tente novamente.')),
      })
      .requestAccessToken({ prompt: 'select_account' });
  });
}
export function disconnectGoogle() {
  const oldToken = accessToken;
  accessToken = '';
  expiresAt = 0;
  if (oldToken) window.google?.accounts.oauth2.revoke(oldToken, () => {});
}
