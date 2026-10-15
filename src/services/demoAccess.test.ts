import { beforeEach, expect, it, vi } from 'vitest';
import type { VercelRequest } from '@vercel/node';
const mocks = vi.hoisted(() => ({ verify: vi.fn(), get: vi.fn() }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: mocks.verify }) }));
vi.mock('../../server/firebaseAdmin', () => ({ adminApp: () => ({}), adminDb: () => ({ doc: () => ({ get: mocks.get }) }) }));
import { requireOwner } from '../../server/access';
beforeEach(() => { mocks.verify.mockResolvedValue({ uid: 'visitor' }); mocks.get.mockResolvedValue({ data: () => ({ readOnly: true }) }); });
it('nega alterações da conta demonstrativa com token válido', async () => {
  await expect(requireOwner({ headers: { authorization: 'Bearer valid' } } as VercelRequest)).rejects.toMatchObject({ code: 'READ_ONLY', status: 403 });
});
it('mantém escrita para conta comum e inicialização de nova conta', async () => {
  for (const value of [{ readOnly: false }, undefined]) {
    mocks.get.mockResolvedValue({ data: () => value });
    await expect(requireOwner({ headers: { authorization: 'Bearer valid' } } as VercelRequest)).resolves.toEqual({ uid: 'visitor' });
  }
});
