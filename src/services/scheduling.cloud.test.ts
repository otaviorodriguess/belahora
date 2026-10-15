import { describe, it, expect } from 'vitest';
import { calculatePublicSlots, assertFree } from '../../shared/scheduling';
import { defaults } from '../data/defaults';
const settings = { ...defaults, hours: Array.from({ length: 7 }, () => ({ active: true, start: '08:00', end: '20:00' })) };
describe('disponibilidade pública', () => {
  it('respeita antecedência, fuso e horizonte', () => {
    const args = { settings, duration: 60, occupancy: [], nowMs: Date.parse('2026-10-10T12:00:00Z') };
    expect(calculatePublicSlots({ ...args, date: '2026-10-10' })[0]).toBe('11:00');
    expect(calculatePublicSlots({ ...args, date: '2026-12-09' })).toEqual([]);
    expect(calculatePublicSlots({ ...args, date: '2026-02-30' })).toEqual([]);
  });
  it('considera duração e intervalo sem revelar clientes', () => {
    const occupancy = [{ appointmentId: 'a', startMinute: 600, endMinute: 660 }];
    expect(() => assertFree({ startMinute: 570, endMinute: 615, gap: 0, occupancy })).toThrow();
    expect(() => assertFree({ startMinute: 660, endMinute: 690, gap: 15, occupancy })).toThrow();
    expect(() => assertFree({ startMinute: 675, endMinute: 720, gap: 15, occupancy })).not.toThrow();
  });
});
