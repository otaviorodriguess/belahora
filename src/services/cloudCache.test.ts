import 'fake-indexeddb/auto';
import { it, expect } from 'vitest';
import { readCache, writeCache, preserveSnapshot } from './cloudCache';
it('separa contas e mantém cópia imutável', async () => {
  await writeCache('a:state', { appointments: [1] });
  expect(await readCache('b:state')).toBeNull();
  await preserveSnapshot('a:backup', { appointments: [1] });
  await preserveSnapshot('a:backup', { appointments: [] });
  expect(await readCache('a:backup')).toEqual({ appointments: [1] });
});
