import { Sparkles, UserRound } from 'lucide-react';
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
          <Sparkles size={28} strokeWidth={1.4} aria-hidden="true" />
        )}
      </div>
      <span className="eyebrow">UM MOMENTO PARA VOCÊ</span>
      <h1>{settings.studio || 'Seu espaço de beleza'}</h1>
      <p className="booking-welcome">Escolha seu cuidado. Encontre seu melhor horário.</p>
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
