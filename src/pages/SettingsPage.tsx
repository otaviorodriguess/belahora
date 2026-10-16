import { useState, type FormEvent } from 'react';
import { Check, Download, Clock3, Smartphone } from 'lucide-react';
import { useAgenda } from '../hooks/useAgenda';
import { useInstall } from '../hooks/useInstall';
import { Modal } from '../components/Modal';
import { BackupPanel } from '../components/BackupPanel';
import { TIME_ZONE } from '../utils/dates';
import { ServicesEditor } from '../components/ServicesEditor';
import { services as defaultServices } from '../data/services';
import { BookingLinkPanel } from '../components/BookingLinkPanel';
import { MigrationPanel } from '../components/MigrationPanel';
import { AccountPanel } from '../components/AccountPanel';
import { BookingAppearance } from '../components/BookingAppearance';
const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export function SettingsPage({ installation }: { installation: ReturnType<typeof useInstall> }) {
  const { settings, saveSettings, loading, storageMode, canWrite, cloudState, readOnly } = useAgenda();
  const [draft, setDraft] = useState(settings);
  const [baseRevision, setBaseRevision] = useState(cloudState?.settingsRevision);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState('');
  const [installHelp, setInstallHelp] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const { install, canInstall, installed } = installation;
  const change = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    setDraft(current => ({ ...current, [key]: value }));
    setSaved(false);
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (imageBusy) return;
    setFormError('');
    if (draft.hours.some((d) => d.start >= d.end)) {
      setFormError('O horário final deve ser posterior ao inicial em todos os dias.');
      return;
    }
    try {
      await saveSettings({ ...draft, mode: 'local' }, baseRevision);
      setBaseRevision(r => r === undefined ? r : r + 1);
      setSaved(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar.');
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">DO SEU JEITO</span>
          <h1>
            Configurações<span className="heading-dot">.</span>
          </h1>
          <p>Uma agenda que acompanha a sua rotina.</p>
        </div>
      </div>
      {storageMode === 'cloud' && !readOnly && <><MigrationPanel /><BookingLinkPanel /></>}
      <div className="settings-columns">
        <form onSubmit={(event) => void submit(event)} className="settings-form">
          <fieldset disabled={readOnly} style={{ display: 'contents' }}>
          <ServicesEditor
            saving={loading || imageBusy}
            services={draft.services ?? defaultServices}
            onChange={(services) => change('services', services)}
          />
          <section className="panel settings-panel">
            <h2>Seu espaço</h2>
            <div className="form-grid">
              <label className="field full">
                Nome da profissional
                <input
                  maxLength={80}
                  autoComplete="name"
                  value={draft.professional}
                  onChange={(e) => change('professional', e.target.value)}
                  placeholder="Como você se chama?"
                />
              </label>
              <label className="field full">
                Nome do espaço
                <input
                  required
                  maxLength={80}
                  value={draft.studio}
                  onChange={(e) => change('studio', e.target.value)}
                />
              </label>
            </div>
          </section>
          <BookingAppearance settings={draft} disabled={loading || readOnly === true || canWrite === false} onChange={change} onBusy={setImageBusy} />
          <section className="panel settings-panel">
            <h2>
              <Clock3 size={21} />
              Horários de atendimento
            </h2>
            <p className="muted small">Defina o expediente de cada dia.</p>
            <div className="working-hours">
              {weekdays.map((name, i) => (
                <div className="working-day" key={name}>
                  <label className="day-toggle">
                    <input
                      type="checkbox"
                      checked={draft.hours[i].active}
                      onChange={(e) =>
                        change(
                          'hours',
                          draft.hours.map((d, index) =>
                            index === i ? { ...d, active: e.target.checked } : d,
                          ),
                        )
                      }
                    />
                    <span>{name}</span>
                  </label>
                  {draft.hours[i].active ? (
                    <div className="time-range">
                      <input
                        aria-label={`Horário inicial de ${name}`}
                        type="time"
                        required
                        value={draft.hours[i].start}
                        onChange={(e) =>
                          change(
                            'hours',
                            draft.hours.map((d, index) =>
                              index === i ? { ...d, start: e.target.value } : d,
                            ),
                          )
                        }
                      />
                      <span>às</span>
                      <input
                        aria-label={`Horário final de ${name}`}
                        type="time"
                        required
                        value={draft.hours[i].end}
                        onChange={(e) =>
                          change(
                            'hours',
                            draft.hours.map((d, index) =>
                              index === i ? { ...d, end: e.target.value } : d,
                            ),
                          )
                        }
                      />
                    </div>
                  ) : (
                    <span className="closed-label">Fechado</span>
                  )}
                </div>
              ))}
            </div>
            <label className="field">
              Intervalo entre atendimentos (min)
              <input
                type="number"
                min={0}
                max={120}
                required
                step={1}
                value={draft.gap}
                onChange={(e) => change('gap', e.target.valueAsNumber)}
              />
            </label>
            <p className="helper">
              Fuso horário do espaço: {TIME_ZONE}. Alterações valem para novos agendamentos e
              edições.
            </p>
          </section>
          {formError && (
            <p role="alert" className="error-message">
              {formError}
            </p>
          )}
          <button className="button" type="submit" disabled={loading || imageBusy || canWrite === false}>
            <Check size={18} />
            {saved ? 'Configurações salvas' : 'Salvar configurações'}
          </button>
          {saved && (
            <p role="status" className="saved-message">
              Tudo pronto. Sua rotina foi atualizada.
            </p>
          )}
          </fieldset>
        </form>
        <div>
          <AccountPanel
            onMigrated={(restored) => {
              setDraft(restored);
              setSaved(false);
            }}
          />
          {!readOnly && <BackupPanel
            onRestored={(restored) => {
              setDraft(restored);
              setSaved(false);
            }}
          />}
          <section className="panel settings-panel install-panel">
            <Smartphone size={28} />
            <h2>Sua agenda sempre por perto</h2>
            <p className="muted small">Instale a Bela Hora e abra direto da tela inicial.</p>
            <button
              className="button secondary"
              onClick={() =>
                void (async () => {
                  if (!(await install())) setInstallHelp(true);
                })()
              }
              disabled={installed}
            >
              <Download size={17} />
              {installed
                ? 'Aplicativo instalado'
                : canInstall
                  ? 'Instalar aplicativo'
                  : 'Como instalar'}
            </button>
            <p className="helper">Android, iPhone e computador.</p>
          </section>
          <section className="privacy-note">
            <h3>Funciona offline</h3>
            <p>
              {storageMode === 'cloud' ? 'Consulte a agenda carregada sem internet. Para confirmar alterações e reservas, conecte-se à internet.' : 'Crie, edite e consulte seus atendimentos sem internet. Não há sincronização com outro aparelho. O backup é a sua cópia de segurança.'}
            </p>
          </section>
        </div>
      </div>
      {installHelp && (
        <Modal title="Instalar a Bela Hora" onClose={() => setInstallHelp(false)}>
          <div className="install-instructions">
            <p>
              <strong>iPhone / iPad</strong>Abra no Safari, toque em Compartilhar e escolha
              “Adicionar à Tela de Início”.
            </p>
            <p>
              <strong>Android</strong>Abra no Chrome e use o menu “Instalar aplicativo” ou
              “Adicionar à tela inicial”.
            </p>
            <p>
              <strong>Computador</strong>Abra no Chrome ou Edge e use o ícone de instalação na barra
              de endereço.
            </p>
            <p className="form-note">
              A instalação exige HTTPS ou localhost. No celular, um endereço HTTP da rede local não
              permite instalar o PWA.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
