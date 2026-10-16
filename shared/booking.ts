import type { Appointment, AppointmentInput, Settings, Service } from '../src/types/index.js';
export type Occupancy = { appointmentId: string; startMinute: number; endMinute: number };
export type CloudAppointment = {
  value: Appointment;
  revision: number;
  status: 'confirmed' | 'cancelled';
  origin: 'owner' | 'public' | 'import';
};
export type CloudState = {
  readOnly?: boolean;
  activeBatch?: string | null;
  settings: Settings;
  settingsRevision: number;
  appointments: CloudAppointment[];
  publicEnabled: boolean;
  linkCode: string | null;
  migrationReady: boolean;
};
export type PublicBookingInput = {
  code: string;
  serviceId: string;
  date: string;
  start: string;
  name: string;
  phone: string;
  operationId: string;
};
export type Receipt = {
  reference: string;
  serviceName: string;
  date: string;
  start: string;
  end: string;
  price: number;
};
export type Catalog = { studio: string; professional: string; professionalPhoto?: string; studioLogo?: string; services: Service[] };
export type Command =
  | { kind: 'create'; input: AppointmentInput; operationId: string }
  | {
      kind: 'update';
      id: string;
      input: AppointmentInput;
      expectedRevision: number;
      operationId: string;
    }
  | { kind: 'cancel'; id: string; expectedRevision: number; operationId: string };
export class BookingError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
