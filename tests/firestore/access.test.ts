import { beforeAll, afterAll, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, setDoc, getDoc } from 'firebase/firestore';
let env: RulesTestEnvironment;
beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')
    throw new Error('Local emulator required');
  env = await initializeTestEnvironment({
    projectId: 'demo-belahora',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'accounts/a'), { settings: {} });
  });
});
afterAll(async () => {
  await env?.cleanup();
});
it('isola leitura e bloqueia gravações diretas e dados públicos', async () => {
  await assertSucceeds(getDoc(doc(env.authenticatedContext('a').firestore(), 'accounts/a')));
  await assertFails(getDoc(doc(env.authenticatedContext('b').firestore(), 'accounts/a')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'accounts/a')));
  await assertFails(
    setDoc(doc(env.authenticatedContext('a').firestore(), 'accounts/a/appointments/x'), {
      name: 'x',
    }),
  );
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'bookingLinks/code')));
});
