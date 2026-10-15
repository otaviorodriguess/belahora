import { expect, it } from 'vitest';
import { authError } from './firebaseAuth';
it('orienta a desmarcar persistência quando armazenamento é negado', () => {
  expect(authError(new DOMException('Denied', 'QuotaExceededError'))).toContain('Desmarque');
});
it('não expõe a existência da conta em erros de credenciais', () => {
  expect(authError({ code: 'auth/user-not-found' })).toBe(
    authError({ code: 'auth/wrong-password' }),
  );
  expect(authError({ code: 'auth/network-request-failed' })).toContain('internet');
});
