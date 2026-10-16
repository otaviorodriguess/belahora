import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { PublicBookingPage } from './pages/PublicBookingPage';
import { AuthProvider } from './contexts/AuthProvider';
import { AuthGate } from './components/AuthGate';
import './styles.css';
import './experience.css';
import './booking.css';
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
      {location.pathname.startsWith('/agendar/') ? <PublicBookingPage code={location.pathname.split('/')[2] || ''} /> : <AuthProvider>
        <AuthGate>
          <App />
        </AuthGate>
      </AuthProvider>}
    </ErrorBoundary>
  </StrictMode>,
);
