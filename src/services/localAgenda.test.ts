import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAgendaRepository } from './localAgenda';
import { defaults } from '../data/defaults';
import type { LocalAgenda } from '../types';

const fixture: LocalAgenda = {
  hoursExtendedTo20: true,
  settings: { ...structuredClone(defaults), studio: 'Agenda original' },
  appointments: [
    {
      id: 'old',
      nomeCliente: 'Cliente preservada',
      telefone: '',
      servico: 'teste',
      valor: 100,
      data: '2026-10-12',
      horaInicio: '10:00',
      horaFim: '11:00',
      duracao: 60,
      observacoes: '',
      createdAt: '2026-10-08T12:00:00Z',
      updatedAt: '2026-10-08T12:00:00Z',
    },
  ],
  updatedAt: '2026-10-08T12:00:00Z',
};
async function raw(action: (store: IDBObjectStore) => void) {
  const db = await new Promise<IDBDatabase>((resolve) => {
    const r = indexedDB.open('aura-local-agenda', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('agenda');
    r.onsuccess = () => resolve(r.result);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('agenda', 'readwrite');
    action(tx.objectStore('agenda'));
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}
const account = (uid: string) =>
  createAgendaRepository({ kind: 'account', projectId: 'demo', uid });
beforeEach(async () => {
  vi.restoreAllMocks();
  await raw((s) => s.clear());
  await raw((s) => s.put(fixture, 'current'));
});
describe('agendas por conta', () => {
  it('conta nova começa sem serviços e catálogo existente permanece intacto', async () => {
    const existing = account('existing');
    await existing.claimLegacy();
    const before = await existing.read();
    const catalog = [{ id: 'custom', nome: 'Serviço existente', preco: 95, duracao: 45 }];
    await existing.saveSettings({ ...before.settings, services: catalog });
    expect((await account('new-user').read()).settings.services).toEqual([]);
    expect((await existing.read()).settings.services).toEqual(catalog);
    expect((await existing.read()).appointments).toEqual(before.appointments);
  });
  it('restauração com confirmação antiga não sobrescreve migração que venceu a transação', async () => {
    const a = account('a');
    const expected = await a.read();
    const outcomes = await Promise.allSettled([
      a.claimLegacy(),
      a.restore({ ...fixture, appointments: [] }, expected),
    ]);
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1].status).toBe('rejected');
    expect((await a.read()).appointments[0].nomeCliente).toBe('Cliente preservada');
  });
  it('restauração válida mantém proprietário e substitui somente a conta ativa', async () => {
    const a = account('a');
    await a.claimLegacy();
    const expected = await a.read();
    await a.restore({ ...fixture, appointments: [] }, expected);
    expect((await a.read()).appointments).toHaveLength(0);
    expect(await account('b').legacyStatus()).toBe('claimed');
    expect((await account('b').read()).settings.studio).toBe('Meu espaço de beleza');
  });
  it('separa contas e não herda configurações antigas', async () => {
    const a = account('a');
    const b = account('b');
    await a.read();
    await a.update((s) => ({ ...s, settings: { ...s.settings, studio: 'A' } }));
    expect((await b.read()).settings.studio).toBe('Meu espaço de beleza');
    expect((await a.read()).settings.studio).toBe('A');
    expect((await b.read()).appointments).toEqual([]);
  });
  it('vincula uma vez sem apagar a agenda original', async () => {
    const a = account('a');
    const b = account('b');
    expect(await a.legacyStatus()).toBe('available');
    expect(await a.claimLegacy()).toEqual(fixture);
    expect(await a.readLegacyForBackup()).toEqual(fixture);
    await expect(b.claimLegacy()).rejects.toThrow();
    await expect(b.readLegacyForBackup()).rejects.toThrow();
    expect((await b.read()).appointments).toHaveLength(0);
  });
  it('duas reivindicações concorrentes têm somente um vencedor', async () => {
    const results = await Promise.allSettled([
      account('a').claimLegacy(),
      account('b').claimLegacy(),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
  it('falha ao registrar proprietário reverte também a cópia', async () => {
    const a = account('a');
    await a.read();
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value,
      key,
    ) {
      if (key === 'legacy-owner') throw new DOMException('quota', 'QuotaExceededError');
      return put.call(this, value, key);
    });
    await expect(a.claimLegacy()).rejects.toThrow();
    vi.restoreAllMocks();
    expect(await a.legacyStatus()).toBe('available');
    expect((await a.read()).appointments).toHaveLength(0);
  });
  it('não sobrescreve destino preenchido e permite vincular após iniciar vazio', async () => {
    const a = account('a');
    await a.read();
    await a.update(() => fixture);
    expect(await a.legacyStatus()).toBe('target-not-empty');
    await expect(a.claimLegacy()).rejects.toThrow();
    expect(await account('b').claimLegacy()).toEqual(fixture);
  });
  it('restauração concorrente não é sobrescrita por migração', async () => {
    const a = account('a');
    await a.read();
    const restored = { ...fixture, settings: { ...fixture.settings, studio: 'Restaurada' } };
    const outcomes = await Promise.allSettled([a.update(() => restored), a.claimLegacy()]);
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1].status).toBe('rejected');
    expect((await a.read()).settings.studio).toBe('Restaurada');
  });
});
