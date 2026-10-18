import App from './App';
import { AuthProvider } from './contexts/AuthProvider';
import { AuthGate } from './components/AuthGate';

export default function OwnerApp() {
  return (
    <AuthProvider>
      <AuthGate>
        <App />
      </AuthGate>
    </AuthProvider>
  );
}
