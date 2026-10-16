import { useEffect, useRef, useState } from 'react';
import { ImagePlus, UserRound, Store } from 'lucide-react';
import type { Settings } from '../types';
import { prepareBrandImage } from '../services/brandImages';
import { BookingIdentity } from './BookingIdentity';

export function BookingAppearance({
  settings,
  disabled,
  onChange,
  onBusy,
}: {
  settings: Settings;
  disabled: boolean;
  onChange: (key: 'professionalPhoto' | 'studioLogo', value: string | undefined) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [processing, setProcessing] = useState('');
  const [error, setError] = useState('');
  const active = useRef(true),
    locked = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function choose(file: File | undefined, key: 'professionalPhoto' | 'studioLogo') {
    if (!file || disabled || locked.current) return;
    locked.current = true;
    setProcessing(key);
    setError('');
    onBusy(true);
    try {
      const image = await prepareBrandImage(file, key === 'professionalPhoto' ? 'photo' : 'logo');
      if (active.current) onChange(key, image);
    } catch (cause) {
      if (active.current)
        setError(cause instanceof Error ? cause.message : 'Não foi possível preparar a imagem.');
    } finally {
      locked.current = false;
      if (active.current) {
        setProcessing('');
        onBusy(false);
      }
    }
  }
  return (
    <section className="panel settings-panel booking-appearance">
      <span className="eyebrow">A PRIMEIRA IMPRESSÃO</span>
      <h2>Aparência do agendamento</h2>
      <p className="muted small">Apresente você e seu espaço para quem chega pelo seu link.</p>
      <div className="brand-upload-grid">
        {(['professionalPhoto', 'studioLogo'] as const).map((key) => (
          <div className="brand-upload" key={key}>
            <div className={`brand-upload-image ${key === 'professionalPhoto' ? 'portrait' : ''}`}>
              {settings[key] ? (
                <img
                  src={settings[key]}
                  alt={key === 'professionalPhoto' ? 'Prévia da foto' : 'Prévia da logo'}
                />
              ) : key === 'professionalPhoto' ? (
                <UserRound size={27} />
              ) : (
                <Store size={27} />
              )}
            </div>
            <strong>
              {key === 'professionalPhoto' ? 'Sua foto' : 'Logo do espaço'} <small>Opcional</small>
            </strong>
            <label className="brand-file-label">
              <ImagePlus size={16} />{' '}
              {processing === key
                ? 'Preparando…'
                : settings[key]
                  ? 'Trocar imagem'
                  : 'Escolher imagem'}
              <input
                type="file"
                aria-label={
                  key === 'professionalPhoto'
                    ? 'Enviar foto da profissional'
                    : 'Enviar logo do espaço'
                }
                accept="image/jpeg,image/png,image/webp"
                disabled={disabled || !!processing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  void choose(file, key);
                }}
              />
            </label>
            {settings[key] && (
              <button
                type="button"
                className="text-button"
                disabled={disabled || !!processing}
                onClick={() => onChange(key, undefined)}
              >
                Remover {key === 'professionalPhoto' ? 'foto' : 'logo'}
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="helper">
        JPG, PNG ou WebP, até 8 MB. A foto usa um recorte central; a logo mantém seu formato. As
        imagens ficam públicas no seu link após salvar.
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {processing && <p role="status">Preparando a imagem para o seu link…</p>}
      <details className="brand-preview">
        <summary>Ver prévia da apresentação</summary>
        <BookingIdentity settings={settings} />
      </details>
      <button type="submit" className="button" disabled={disabled || !!processing}>
        Salvar aparência
      </button>
      <p className="helper">Salva também as outras configurações preenchidas nesta página.</p>
    </section>
  );
}
