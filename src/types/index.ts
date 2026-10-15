export interface Service {
  active?: boolean;
  id: string;
  nome: string;
  preco: number;
  duracao: number;
}
export interface Appointment {
  id: string;
  nomeCliente: string;
  telefone: string;
  servico: string;
  servicos?: string[];
  serviceNames?: string[];
  valor: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  duracao: number;
  observacoes: string;
  googleEventId?: string;
  createdAt: string;
  updatedAt: string;
  etag?: string;
}
export interface BusyEvent {
  id: string;
  title: string;
  start: string;
  end: string;
}
export interface ScheduleSnapshot {
  appointments: Appointment[];
  busy: BusyEvent[];
  syncedAt: string;
}
export interface WorkingDay {
  active: boolean;
  start: string;
  end: string;
}
export interface Settings {
  services?: Service[];
  professional: string;
  studio: string;
  gap: number;
  hours: WorkingDay[];
  mode: 'local' | 'demo' | 'google';
  cachedCalendarId?: string;
}
export type AppointmentInput = Omit<
  Appointment,
  'id' | 'googleEventId' | 'createdAt' | 'updatedAt' | 'etag'
>;
export type Page = 'home' | 'agenda' | 'search' | 'settings';
export interface LocalAgenda {
  hoursExtendedTo20?: boolean;
  appointments: Appointment[];
  settings: Settings;
  updatedAt: string;
}
export interface AgendaBackup extends LocalAgenda {
  format: 'aura-agenda';
  version: 1;
  exportedAt: string;
}
