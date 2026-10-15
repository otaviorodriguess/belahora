import { describe, expect, it } from 'vitest';
import { createBackup, parseBackup } from './backup';
import { defaults } from '../data/defaults';
const appointment = {
  id: 'abc',
  nomeCliente: 'Maria',
  telefone: '88999999999',
  servico: 'limpeza-pele',
  valor: 100,
  data: '2026-10-02',
  horaInicio: '09:00',
  horaFim: '10:00',
  duracao: 60,
  observacoes: '',
  createdAt: '2026-09-24T12:00:00Z',
  updatedAt: '2026-09-24T12:00:00Z',
};
const snapshot = {
  appointments: [appointment],
  settings: defaults,
  updatedAt: appointment.updatedAt,
};
describe('backup local', () => {
  it('leva o catálogo personalizado e os nomes históricos no backup', () => {
    const custom = { id: 'custom', nome: 'Massagem', preco: 150, duracao: 90, active: true };
    const state = {
      ...snapshot,
      settings: { ...defaults, services: [custom] },
      appointments: [{ ...appointment, servico: 'custom', serviceNames: ['Massagem anterior'] }],
    };
    const restored = parseBackup(JSON.stringify(createBackup(state)));
    expect(restored.settings.services).toEqual([custom]);
    expect(restored.appointments[0].serviceNames).toEqual(['Massagem anterior']);
    expect(() =>
      parseBackup(
        JSON.stringify(
          createBackup({
            ...state,
            settings: { ...defaults, services: [{ ...custom, preco: -1 }] },
          }),
        ),
      ),
    ).toThrow();
  });
  it('preserva vários procedimentos e rejeita listas inválidas', () => {
    const servicos = ['limpeza-pele', 'dermaplaning'];
    const restored = parseBackup(
      JSON.stringify(createBackup({ ...snapshot, appointments: [{ ...appointment, servicos }] })),
    );
    expect(restored.appointments[0].servicos).toEqual(servicos);
    for (const invalid of [[], ['limpeza-pele', 'limpeza-pele'], ['dermaplaning'], [12]]) {
      expect(() =>
        parseBackup(
          JSON.stringify({
            ...createBackup(snapshot),
            appointments: [{ ...appointment, servicos: invalid }],
          }),
        ),
      ).toThrow();
    }
  });
  it('exporta e importa todos os dados e preferências', () => {
    const restored = parseBackup(JSON.stringify(createBackup(snapshot)));
    expect(restored.appointments).toEqual(snapshot.appointments);
    expect(restored.settings).toEqual(defaults);
  });
  it('rejeita JSON inválido, versões desconhecidas e IDs repetidos', () => {
    expect(() => parseBackup('não é json')).toThrow();
    expect(() => parseBackup(JSON.stringify({ ...createBackup(snapshot), version: 2 }))).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify(createBackup({ ...snapshot, appointments: [appointment, appointment] })),
      ),
    ).toThrow();
  });
  it('rejeita valores, horários e configurações adulterados', () => {
    for (const change of [
      { valor: -10 },
      { horaFim: '11:00' },
      { data: '2026-02-31' },
      { nomeCliente: '' },
      { duracao: 0 },
    ]) {
      expect(() =>
        parseBackup(
          JSON.stringify(
            createBackup({ ...snapshot, appointments: [{ ...appointment, ...change }] }),
          ),
        ),
      ).toThrow();
    }
    expect(() =>
      parseBackup(
        JSON.stringify(createBackup({ ...snapshot, settings: { ...defaults, gap: -1 } })),
      ),
    ).toThrow();
  });
  it('preserva histórico fora do expediente atual e descarta campos externos', () => {
    const result = parseBackup(
      JSON.stringify(
        createBackup({ ...snapshot, appointments: [{ ...appointment, googleEventId: 'foreign' }] }),
      ),
    );
    expect(result.appointments[0]).not.toHaveProperty('googleEventId');
    expect(result.settings.mode).toBe('local');
  });
});
