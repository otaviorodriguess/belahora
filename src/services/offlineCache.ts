import type { ScheduleSnapshot } from '../types';
const CACHE = 'aura-agenda-snapshot-v1';
const cacheKey = (id: string) => `${location.origin}/__aura_snapshot__/${encodeURIComponent(id)}`;
export async function readSnapshot(id: string): Promise<ScheduleSnapshot | null> {
  try {
    const cache = await caches.open(CACHE);
    const response = await cache.match(cacheKey(id));
    if (!response) return null;
    const data = (await response.json()) as ScheduleSnapshot;
    return Array.isArray(data.appointments) && Array.isArray(data.busy) ? data : null;
  } catch {
    return null;
  }
}
export async function writeSnapshot(id: string, data: ScheduleSnapshot) {
  const cache = await caches.open(CACHE);
  await cache.put(
    cacheKey(id),
    new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }),
  );
}
export async function clearSnapshots() {
  if ('caches' in window) await caches.delete(CACHE);
}
