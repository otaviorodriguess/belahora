import type { Settings } from '../types';
import { defaults } from '../data/defaults';
const KEY = 'aura.settings.v1';
export function readSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as Settings | null;
    if (!raw || !Array.isArray(raw.hours) || raw.hours.length !== 7)
      return structuredClone(defaults);
    if (
      raw.hours.some(
        (d) =>
          typeof d.active !== 'boolean' ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.start) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.end) ||
          d.start >= d.end,
      )
    )
      return structuredClone(defaults);
    return {
      ...defaults,
      ...raw,
      professional: typeof raw.professional === 'string' ? raw.professional : '',
      studio: typeof raw.studio === 'string' ? raw.studio : defaults.studio,
      gap: Number.isInteger(raw.gap) && raw.gap >= 0 && raw.gap <= 120 ? raw.gap : 0,
      mode: 'local',
    };
  } catch {
    return structuredClone(defaults);
  }
}
export function writeSettings(settings: Settings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
