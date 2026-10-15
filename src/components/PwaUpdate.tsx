import { useRegisterSW } from 'virtual:pwa-register/react';
export function PwaUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="update-banner" role="status">
      <p>Uma nova versão da Bela Hora está pronta.</p>
      <button className="button" onClick={() => void updateServiceWorker(true)}>
        Atualizar
      </button>
      <button className="text-button" onClick={() => setNeedRefresh(false)}>
        Depois
      </button>
    </div>
  );
}

