import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { AgendaProvider } from '../contexts/AgendaProvider';
import { createAgendaRepository, type AgendaRepository } from '../services/localAgenda';
import { LoginForm } from './LoginForm';
import { CloudAgendaProvider } from '../contexts/CloudAgendaProvider';

function AccountAgenda({
  repository,
  children,
}: {
  repository: AgendaRepository;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    repository
      .legacyStatus()
      .then(async (value) => {
        if (!active) return;
        if (value === 'available') {
          try {
            await repository.claimLegacy();
          } catch (cause) {
            // Another tab may have completed the claim or filled this account.
            // Real storage failures must remain visible; never continue as empty.
            const latest = await repository.legacyStatus();
            if (latest !== 'claimed' && latest !== 'target-not-empty') throw cause;
          }
        }
        if (active) setStatus('ready');
      })
      .catch((cause) => {
        if (active) {
          setStatus('error');
          setError(cause instanceof Error ? cause.message : 'Não foi possível ler a agenda.');
        }
      });
    return () => {
      active = false;
    };
  }, [repository]);
  if (status === 'loading')
    return (
      <main className="auth-shell">
        <p role="status">Abrindo sua agenda…</p>
      </main>
    );
  if (status === 'error')
    return (
      <main className="auth-shell">
        <section className="panel auth-card">
          <p role="alert">{error}</p>
          <button className="button" onClick={() => location.reload()}>
            Tentar novamente
          </button>
        </section>
      </main>
    );
  return <AgendaProvider repository={repository}>{children}</AgendaProvider>;
}
export function AuthGate({ children }: { children: ReactNode }) {
  const { state, retry } = useAuth();
  const uid = state.status === 'signed-in' ? state.identity.uid : '';
  const projectId = state.status === 'signed-in' ? state.identity.projectId : '';
  const repository = useMemo(
    () => (uid ? createAgendaRepository({ kind: 'account', projectId, uid }) : null),
    [uid, projectId],
  );
  if (state.status === 'disabled') return <AgendaProvider>{children}</AgendaProvider>;
  if (state.status === 'loading')
    return (
      <main className="auth-shell">
        <p role="status">Verificando seu acesso…</p>
      </main>
    );
  if (state.status === 'error')
    return (
      <main className="auth-shell">
        <section className="panel auth-card">
          <h1>Não foi possível abrir o login</h1>
          <p role="alert">{state.message}</p>
          <button className="button" onClick={retry}>
            Tentar novamente
          </button>
        </section>
      </main>
    );
  if (state.status === 'signed-out') return <LoginForm />;
  if (state.status !== 'signed-in' || !repository) return null;
  if (import.meta.env.VITE_CLOUD_AGENDA_ENABLED === 'true')
    return <CloudAgendaProvider key={repository.channelName} identity={state.identity}>{children}</CloudAgendaProvider>;
  return (
    <AccountAgenda key={repository.channelName} repository={repository}>
      {children}
    </AccountAgenda>
  );
}
