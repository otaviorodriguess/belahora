import { createContext } from 'react';
import type { AuthState } from '../services/firebaseAuth';
export const AuthContext = createContext<{ state: AuthState; retry: () => void }>({
  state: { status: 'loading' },
  retry: () => {},
});
