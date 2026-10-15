import { format, parseISO, addDays, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
export const TIME_ZONE = import.meta.env.VITE_TIME_ZONE || 'America/Sao_Paulo';
export const dateKey = (date: Date) => format(date, 'yyyy-MM-dd');
export const todayKey = () => formatInTimeZone(new Date(), TIME_ZONE, 'yyyy-MM-dd');
export const displayDate = (date: string, pattern = "dd 'de' MMMM") =>
  format(parseISO(date), pattern, { locale: ptBR });
export const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
export const minutes = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
};
export const endTime = (start: string, duration: number) => {
  const n = minutes(start) + duration;
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
};
export const instant = (date: string, time: string) =>
  fromZonedTime(`${date}T${time}:00`, TIME_ZONE).toISOString();
export const weekDates = (key: string) => {
  const start = startOfWeek(parseISO(key), { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => dateKey(addDays(start, i)));
};
export const periodRange = (key: string) => {
  const current = todayKey();
  const firstYear = Math.min(Number(current.slice(0, 4)) - 2, Number(key.slice(0, 4)));
  const lastYear = Math.max(Number(current.slice(0, 4)) + 1, Number(key.slice(0, 4)) + 1);
  return { start: `${firstYear}-01-01`, end: `${lastYear + 1}-01-01` };
};
