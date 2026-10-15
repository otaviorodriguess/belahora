import {
  getFirestore,
  connectFirestoreEmulator,
  getDocFromServer,
  getDocsFromServer,
  doc,
  collection,
  onSnapshot,
} from 'firebase/firestore';
import { getFirebaseAuth } from './firebaseClient';
import type { AuthIdentity } from './firebaseAuth';
import type { CloudState, CloudAppointment } from '../../shared/booking';
let connected = false;
export function cloudDb() {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Login necessário.');
  const db = getFirestore(auth.app);
  if (import.meta.env.DEV && import.meta.env.VITE_FIRESTORE_EMULATOR === 'true' && !connected) {
    if (auth.app.options.projectId !== 'demo-belahora') throw new Error('Unsafe emulator');
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connected = true;
  }
  return db;
}
export function scopeKey(identity: AuthIdentity) {
  return JSON.stringify([identity.projectId, identity.uid]);
}
export async function ownerRequest<T = unknown>(identity: AuthIdentity, data: unknown): Promise<T> {
  const auth = getFirebaseAuth(),
    user = auth?.currentUser;
  if (!user || user.uid !== identity.uid || auth!.app.options.projectId !== identity.projectId)
    throw new Error('A conta mudou. Entre novamente.');
  if (!navigator.onLine) throw new Error('Conecte à internet para confirmar esta alteração.');
  const token = await user.getIdToken();
  if (auth?.currentUser !== user) throw new Error('A conta mudou.');
  const response = await fetch('/api/agenda', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (auth?.currentUser !== user) throw new Error('A conta mudou.');
  if (!response.ok) throw new Error(result.message || 'Não foi possível salvar.');
  return result;
}
export async function loadCloud(identity: AuthIdentity): Promise<CloudState | null> {
  const db = cloudDb(),
    ref = doc(db, 'accounts', identity.uid);
  const [account, appointments] = await Promise.all([
    getDocFromServer(ref),
    getDocsFromServer(collection(ref, 'appointments')),
  ]);
  return account.exists()
    ? ({
        ...account.data(),
        appointments: appointments.docs.map((d) => d.data() as CloudAppointment),
      } as CloudState)
    : null;
}
export function subscribeCloud(
  identity: AuthIdentity,
  onState: (s: CloudState) => void,
  onError: (e: Error) => void,
) {
  const ref = doc(cloudDb(), 'accounts', identity.uid);
  let account: Record<string, unknown> | undefined, appointments: CloudAppointment[] | undefined;
  const publish = () => {
    if (account && appointments) onState({ ...account, appointments } as CloudState);
  };
  const a = onSnapshot(
    ref,
    { includeMetadataChanges: true },
    (s) => {
      if (!s.metadata.fromCache && s.exists()) {
        account = s.data();
        publish();
      }
    },
    onError,
  );
  const b = onSnapshot(
    collection(ref, 'appointments'),
    { includeMetadataChanges: true },
    (s) => {
      if (!s.metadata.fromCache) {
        appointments = s.docs.map((d) => d.data() as CloudAppointment);
        publish();
      }
    },
    onError,
  );
  return () => {
    a();
    b();
  };
}
