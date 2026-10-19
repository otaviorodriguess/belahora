import { StrictMode, Component, Suspense, lazy, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { PublicBookingPage } from './pages/PublicBookingPage';
import './styles.css';
import './experience.css';
import './booking.css';
import './public-booking.css';
const OwnerApp = lazy(() => import('./OwnerApp'));
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="empty-state">
        <h1>Vamos tentar novamente?</h1>
        <p>Não foi possível abrir a agenda.</p>
        <button className="button" onClick={() => location.reload()}>
          Recarregar aplicativo
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {location.pathname.startsWith('/agendar/') ? (
        <PublicBookingPage code={location.pathname.split('/')[2] || ''} />
      ) : (
        <Suspense fallback={<main className="empty-state">Abrindo sua agenda…</main>}>
          <OwnerApp />
        </Suspense>
      )}
    </ErrorBoundary>
  </StrictMode>,
);
