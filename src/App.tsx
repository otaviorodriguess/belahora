import { useState } from 'react';
import { AppLayout } from './layouts/AppLayout';
import { AgendaPage } from './pages/AgendaPage';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { AppointmentForm } from './components/AppointmentForm';
import { AppointmentDetails } from './components/AppointmentDetails';
import { SyncStatus } from './components/SyncStatus';
import { PwaUpdate } from './components/PwaUpdate';
import { useAgenda } from './hooks/useAgenda';
import { useInstall } from './hooks/useInstall';
import type { Appointment, Page } from './types';
export default function App() {
  const [page, setPage] = useState<Page>('agenda');
  const agenda = useAgenda();
  const installation = useInstall();
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [form, setForm] = useState<{ existing?: Appointment; reschedule?: boolean } | null>(null);
  const navigate = (p: Page) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  return (
    <AppLayout
      page={page}
      setPage={navigate}
      studio={agenda.settings.studio}
      professional={agenda.settings.professional}
      onAdd={() => setForm({})}
    >
      <SyncStatus />
      {!agenda.ready && <p role="status">Sua agenda ainda não foi carregada.</p>}
      {agenda.ready && page === 'agenda' && (
        <AgendaPage
          appointments={agenda.appointments}
          busy={agenda.busy}
          selected={agenda.selected}
          onSelect={agenda.setSelected}
          onOpen={setDetail}
          onAdd={() => setForm({})}
        />
      )}
      {agenda.ready && page === 'home' && (
        <HomePage onOpen={setDetail} onAgenda={() => navigate('agenda')} />
      )}
      {agenda.ready && page === 'search' && <SearchPage onOpen={setDetail} />}
      {page === 'settings' && agenda.ready && (
        <SettingsPage
          key={
            agenda.storageMode === 'cloud' ? (agenda.cloudState ? 'remote' : 'pending') : 'local'
          }
          installation={installation}
        />
      )}
      {detail && !form && (
        <AppointmentDetails
          appointment={detail}
          onClose={() => setDetail(null)}
          onEdit={(reschedule) => {
            setForm({ existing: detail, reschedule });
            setDetail(null);
          }}
        />
      )}
      {form && (
        <AppointmentForm
          existing={form.existing}
          reschedule={form.reschedule}
          onClose={() => setForm(null)}
        />
      )}
      <PwaUpdate />
    </AppLayout>
  );
}
