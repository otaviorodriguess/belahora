let pending: Promise<IDBDatabase> | undefined;
function db() {
  return (pending ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('bela-hora-cloud-cache', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('data');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }).catch((e) => {
    pending = undefined;
    throw e;
  }));
}
export async function readCache<T>(key: string): Promise<T | null> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction('data').objectStore('data').get(key);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => reject(r.error);
  });
}
async function write(key: string, value: unknown, once: boolean) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction('data', 'readwrite'),
      s = t.objectStore('data');
    if (once) {
      const r = s.get(key);
      r.onsuccess = () => {
        if (r.result === undefined) s.put(value, key);
      };
    } else s.put(value, key);
    t.oncomplete = () => resolve();
    t.onabort = () => reject(t.error);
    t.onerror = () => {};
  });
}
export const writeCache = (key: string, value: unknown) => write(key, value, false);
export const preserveSnapshot = (key: string, value: unknown) => write(key, value, true);
