import { useState, type FormEvent } from 'react';
import { LogIn, Mail } from 'lucide-react';
import { authError, resetPassword, signIn } from '../services/firebaseAuth';
export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (recovery) {
        await resetPassword(email);
        setNotice(
          'Se houver uma conta para este e-mail, você receberá as instruções para recuperar a senha. Confira também o spam.',
        );
      } else {
        await signIn(email, password, remember);
        setPassword('');
      }
    } catch (cause) {
      setError(authError(cause));
      setPassword('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <section className="panel auth-card">
        <div className="brand">
          <img src="/favicon.svg" alt="" />
          <div>
            Bela Hora<span>AGENDA & CUIDADO</span>
          </div>
        </div>
        <div>
          <span className="eyebrow">SEU TEMPO, BEM CUIDADO</span>
          <h1>{recovery ? 'Recuperar acesso' : 'Entre na sua agenda'}</h1>
          <p className="muted">
            {recovery
              ? 'Vamos enviar as instruções para o seu e-mail.'
              : 'Um espaço para organizar seus atendimentos com calma.'}
          </p>
        </div>
        <form onSubmit={(event) => void submit(event)} className="auth-form">
          <label className="field">
            E-mail
            <input
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </label>
          {!recovery && (
            <>
              <label className="field">
                Senha
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="auth-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={busy}
                />
                Manter acesso neste aparelho
              </label>
              <p className="helper">
                Use esta opção apenas no seu aparelho pessoal. Ela permite reabrir a agenda sem
                internet; outras pessoas com acesso ao aparelho também poderão abri-la.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="saved-message">
              {notice}
            </p>
          )}
          <button className="button" type="submit" disabled={busy}>
            {recovery ? <Mail size={18} /> : <LogIn size={18} />}
            {busy ? 'Aguarde…' : recovery ? 'Enviar recuperação' : 'Entrar'}
          </button>
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => {
              setRecovery(!recovery);
              setPassword('');
              setError('');
              setNotice('');
            }}
          >
            {recovery ? 'Voltar para entrar' : 'Esqueci minha senha'}
          </button>
        </form>
        <p className="integration-note">
          {import.meta.env.VITE_CLOUD_AGENDA_ENABLED === 'true'
            ? 'Entre na mesma conta para acessar seus agendamentos em outros aparelhos. A sincronização precisa de internet. Para obter uma conta, fale com quem administra o espaço.'
            : 'Seus agendamentos continuam neste aparelho. O login não sincroniza a agenda entre celulares. Para obter uma conta, fale com quem administra o espaço.'}
        </p>
      </section>
    </main>
  );
}
