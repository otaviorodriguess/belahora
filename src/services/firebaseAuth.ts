import {
  browserLocalPersistence,
  inMemoryPersistence,
  onIdTokenChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from './firebaseClient';
export type AuthIdentity = { projectId: string; uid: string; email: string | null };
export type AuthState =
  | { status: 'disabled' | 'loading' | 'signed-out' }
  | { status: 'signed-in'; identity: AuthIdentity }
  | { status: 'error'; message: string };
const logoutKey = 'bela-hora:logout';
function code(error: unknown) {
  return (error as { code?: string })?.code;
}
export function authError(error: unknown): string {
  if (error instanceof DOMException && ['QuotaExceededError', 'SecurityError'].includes(error.name))
    return 'O navegador não permitiu manter o acesso. Desmarque a opção e tente novamente.';
  switch (code(error)) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'E-mail ou senha incorretos. Confira e tente novamente.';
    case 'auth/invalid-email':
      return 'Confira o endereço de e-mail.';
    case 'auth/network-request-failed':
      return 'Não foi possível conectar. Confira sua internet e tente novamente.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada. Fale com quem administra a agenda.';
    case 'auth/operation-not-allowed':
      return 'O login por e-mail ainda não foi ativado no Firebase.';
    case 'auth/web-storage-unsupported':
      return 'O navegador não permitiu manter o acesso. Desmarque a opção e tente novamente.';
    default:
      return 'Não foi possível concluir. Tente novamente ou fale com quem administra a agenda.';
  }
}
function requiredAuth() {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Login não ativado.');
  return auth;
}
export async function signIn(email: string, password: string, remember: boolean) {
  const auth = requiredAuth();
  await setPersistence(auth, remember ? browserLocalPersistence : inMemoryPersistence);
  await signInWithEmailAndPassword(auth, email.trim(), password);
}
export async function signOut() {
  const auth = requiredAuth();
  const uid = auth.currentUser?.uid;
  // Send before SDK persistence clears the identity in other tabs.
  if (uid) {
    const payload = { uid, projectId: auth.app.options.projectId, nonce: crypto.randomUUID() };
    if ('BroadcastChannel' in window) {
      const c = new BroadcastChannel(logoutKey);
      c.postMessage(payload);
      c.close();
    }
    try {
      localStorage.setItem(logoutKey, JSON.stringify(payload));
    } catch {
      /* BroadcastChannel still works. */
    }
  }
  await firebaseSignOut(auth);
}
export async function resetPassword(email: string) {
  try {
    await sendPasswordResetEmail(requiredAuth(), email.trim());
  } catch (error) {
    if (code(error) !== 'auth/user-not-found') throw error;
  }
}
export function subscribeAuth(listener: (state: AuthState) => void): () => void {
  let auth;
  try {
    auth = getFirebaseAuth();
  } catch (error) {
    listener({
      status: 'error',
      message: error instanceof Error ? error.message : authError(error),
    });
    return () => {};
  }
  if (!auth) {
    listener({ status: 'disabled' });
    return () => {};
  }
  const client = auth;
  let active = true;
  let validating = false;
  const publish = (user: User | null) => {
    if (!active) return;
    listener(
      user
        ? {
            status: 'signed-in',
            identity: {
              projectId: client.app.options.projectId!,
              uid: user.uid,
              email: user.email,
            },
          }
        : { status: 'signed-out' },
    );
  };
  const verify = async () => {
    if (!navigator.onLine || !client.currentUser || validating) return;
    const verifiedUser = client.currentUser;
    validating = true;
    try {
      await verifiedUser.getIdToken(true);
    } catch (error) {
      if (
        active &&
        client.currentUser === verifiedUser &&
        [
          'auth/user-disabled',
          'auth/user-token-expired',
          'auth/invalid-user-token',
          'auth/user-not-found',
        ].includes(code(error) || '')
      ) {
        await firebaseSignOut(client);
      }
      // A transient network failure must not discard an open appointment form.
    } finally {
      validating = false;
    }
  };
  const unsubscribe = onIdTokenChanged(client, publish, () => {
    if (active)
      listener({
        status: 'error',
        message: 'Não foi possível restaurar o acesso. Tente novamente.',
      });
  });
  const receive = (payload: unknown) => {
    const message = payload as { uid?: string; projectId?: string };
    if (
      message?.uid === client.currentUser?.uid &&
      message?.projectId === client.app.options.projectId
    ) {
      listener({ status: 'signed-out' });
      void firebaseSignOut(client).catch(() => {});
    }
  };
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(logoutKey) : null;
  if (channel) channel.onmessage = (e) => receive(e.data);
  const storage = (event: StorageEvent) => {
    if (event.key !== logoutKey || !event.newValue) return;
    try {
      receive(JSON.parse(event.newValue));
    } catch {
      /* Ignore unrelated/malformed storage events. */
    }
  };
  const visible = () => {
    if (document.visibilityState === 'visible') void verify();
  };
  window.addEventListener('storage', storage);
  window.addEventListener('online', verify);
  document.addEventListener('visibilitychange', visible);
  const interval = window.setInterval(() => void verify(), 5 * 60 * 1000);
  return () => {
    active = false;
    unsubscribe();
    channel?.close();
    window.clearInterval(interval);
    window.removeEventListener('storage', storage);
    window.removeEventListener('online', verify);
    document.removeEventListener('visibilitychange', visible);
  };
}
