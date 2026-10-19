import { UserRound } from 'lucide-react';
import type { Settings } from '../types';

export function BookingIdentity({
  settings,
}: {
  settings: Pick<Settings, 'studio' | 'professional' | 'professionalPhoto' | 'studioLogo'>;
}) {
  return (
    <div className="booking-identity">
      <div className="booking-studio-mark">
        {settings.studioLogo ? (
          <img src={settings.studioLogo} alt={`Logo de ${settings.studio || 'seu espaço'}`} />
        ) : (
          <span className="booking-monogram" aria-hidden="true">{(settings.studio || 'Bela Hora').trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('')}</span>
        )}
      </div>
      <span className="eyebrow">BELEZA NO SEU TEMPO</span>
      <h1>{settings.studio || 'Seu espaço de beleza'}</h1>
      <p className="booking-welcome">Seu próximo momento de cuidado começa aqui.</p>
      {(settings.professional || settings.professionalPhoto) && (
        <div className="booking-professional">
          {settings.professionalPhoto ? (
            <img
              src={settings.professionalPhoto}
              alt={`Foto de ${settings.professional || 'sua profissional'}`}
            />
          ) : (
            <span className="booking-avatar-placeholder">
              <UserRound size={19} aria-hidden="true" />
            </span>
          )}
          <div>
            <span>Seu atendimento com</span>
            <strong>{settings.professional || 'Sua profissional'}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
