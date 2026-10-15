import { createContext } from 'react';
import type { CloudState } from '../../shared/booking';
import type { AuthIdentity } from '../services/firebaseAuth';
import type {
  AgendaBackup,
  Appointment,
  AppointmentInput,
  LocalAgenda,
  ScheduleSnapshot,
  Settings,
} from '../types';
export interface AgendaState extends ScheduleSnapshot {
  readOnly?: boolean;
  storageMode?: 'cloud';
  canWrite?: boolean;
  cloudState?: CloudState | null;
  identity?: AuthIdentity;
  settings: Settings;
  online: boolean;
  ready: boolean;
  loading: boolean;
  error: string;
  notice: string;
  selected: string;
  setSelected: (value: string) => void;
  saveSettings: (settings: Settings, expectedRevision?: number) => Promise<void>;
  save: (input: AppointmentInput, existing?: Appointment, id?: string) => Promise<void>;
  remove: (a: Appointment) => Promise<void>;
  refresh: () => Promise<void>;
  backup: () => Promise<LocalAgenda>;
  restore: (backup: AgendaBackup, expected: LocalAgenda) => Promise<void>;
  clearNotice: () => void;
}
export const AgendaContext = createContext<AgendaState | null>(null);
