import 'fake-indexeddb/auto';
import { it, expect, vi } from 'vitest';
import { defaults } from '../data/defaults';

import { resumeMigration, prepareMigration } from './agendaMigration';
const request = vi.hoisted(() => vi.fn().mockResolvedValue({ complete: false }));
vi.mock('./cloudAgenda', () => ({ ownerRequest: request, scopeKey: () => 'resume-test' }));
it('retoma do backup preservado, reenviando lotes antes de concluir', async () => {
  const snapshot = {
    appointments: Array.from({ length: 51 }, (_, index) => ({
      id: `old-${index}`, nomeCliente: 'Cliente preservada', telefone: '', servico: 's',
      valor: 30, data: '2025-01-01', horaInicio: '10:00', horaFim: '11:00', duracao: 60,
      observacoes: '', createdAt: '2025-01-01', updatedAt: '2025-01-01',
    })),
    settings: defaults,
    updatedAt: '',
  };
  const { batchId } = await prepareMigration(
    { projectId: 'demo', uid: 'u', email: null },
    snapshot,
  );
  await resumeMigration({ projectId: 'demo', uid: 'u', email: null }, batchId, () => true);
  expect(request.mock.calls.map((c) => c[1].action)).toEqual([
    'import-start', 'import-records', 'import-records', 'import-complete',
  ]);
  expect(request.mock.calls[1][1].records).toHaveLength(50);
  expect(request.mock.calls[2][1].records).toHaveLength(1);
});
it('informa como recuperar quando a cópia está em outro aparelho', async () => {
  await expect(
    resumeMigration({ projectId: 'demo', uid: 'u', email: null }, 'missing', () => true),
  ).rejects.toThrow(/aparelho/);
});
