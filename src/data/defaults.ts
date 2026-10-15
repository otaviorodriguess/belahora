import type { Settings } from '../types';
export const defaults: Settings = {
  professional: '',
  studio: 'Meu espaço de beleza',
  gap: 0,
  mode: 'local',
  hours: Array.from({ length: 7 }, (_, i) => ({
    active: i !== 0,
    start: '08:00',
    end: '20:00',
  })),
};
