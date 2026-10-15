import { useEffect, useState, type ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import { subscribeAuth, type AuthState } from '../services/firebaseAuth';
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => subscribeAuth(setState), [attempt]);
  return (
    <AuthContext.Provider
      value={{
        state,
        retry: () => {
          setState({ status: 'loading' });
          setAttempt((n) => n + 1);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
