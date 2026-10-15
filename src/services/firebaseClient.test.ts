import { describe, expect, it } from 'vitest';
import { readFirebaseConfig } from './firebaseClient';
describe('configuração de autenticação', () => {
  it('modo local explícito não precisa de Firebase', () => {
    expect(readFirebaseConfig({ VITE_AUTH_ENABLED: 'false' })).toBeNull();
  });
  it('ativação incompleta não cai no modo sem login', () => {
    expect(() => readFirebaseConfig({ VITE_AUTH_ENABLED: 'true' })).toThrow();
  });
  it('rejeita flag incorreta em vez de abrir agenda', () => {
    expect(() => readFirebaseConfig({ VITE_AUTH_ENABLED: 'tru' })).toThrow();
  });
  it('carrega somente configuração web obrigatória', () => {
    expect(
      readFirebaseConfig({
        VITE_AUTH_ENABLED: 'true',
        VITE_FIREBASE_API_KEY: 'web-key',
        VITE_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
        VITE_FIREBASE_PROJECT_ID: 'demo',
        VITE_FIREBASE_APP_ID: 'app',
      }),
    ).toEqual({
      apiKey: 'web-key',
      authDomain: 'demo.firebaseapp.com',
      projectId: 'demo',
      appId: 'app',
    });
  });
});
