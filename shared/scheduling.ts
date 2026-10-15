import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { Settings } from '../src/types/index.js';
import { BookingError, type Occupancy } from './booking.js';
export const ZONE = 'America/Sao_Paulo';
export const mins = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
export const clock = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, '0')}:${(n % 60).toString().padStart(2, '0')}`;
export function validDate(date: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date
  );
}
export function assertFree({
  startMinute: s,
  endMinute: e,
  gap,
  occupancy,
  ignoreId,
}: {
  startMinute: number;
  endMinute: number;
  gap: number;
  occupancy: Occupancy[];
  ignoreId?: string;
}) {
  if (
    occupancy.some(
      (a) => a.appointmentId !== ignoreId && s < a.endMinute + gap && e + gap > a.startMinute,
    )
  )
    throw new BookingError('CONFLICT', 'Este horário acabou de ser ocupado. Escolha outro.', 409);
}
export function assertSchedule(date: string, time: string, duration: number, settings: Settings) {
  if (
    !validDate(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
    !Number.isInteger(duration) ||
    duration < 5 ||
    duration > 720
  )
    throw new BookingError('INVALID_INPUT', 'Data, horário ou duração inválidos.');
  const day = settings.hours[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const s = mins(time),
    e = s + duration;
  if (!day?.active || s < mins(day.start) || e > mins(day.end) || e > 1439)
    throw new BookingError('INVALID_INPUT', 'Horário fora do expediente.');
}
export function calculatePublicSlots({
  date,
  duration,
  settings,
  occupancy,
  nowMs,
}: {
  date: string;
  duration: number;
  settings: Settings;
  occupancy: Occupancy[];
  nowMs: number;
}): string[] {
  if (!validDate(date) || !Number.isInteger(duration) || duration < 5 || duration > 720) return [];
  const today = formatInTimeZone(nowMs, ZONE, 'yyyy-MM-dd');
  const offset = (Date.parse(date) - Date.parse(today)) / 86400000;
  if (offset < 0 || offset >= 60) return [];
  const day = settings.hours[new Date(`${date}T12:00:00Z`).getUTCDay()];
  if (!day?.active) return [];
  const result: string[] = [];
  for (let s = mins(day.start); s + duration <= Math.min(mins(day.end), 1439); s += 15) {
    if (fromZonedTime(`${date}T${clock(s)}:00`, ZONE).getTime() < nowMs + 7200000) continue;
    try {
      assertFree({ startMinute: s, endMinute: s + duration, gap: settings.gap, occupancy });
      result.push(clock(s));
    } catch {
      /* Occupied. */
    }
  }
  return result;
}
