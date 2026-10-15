import { spawnSync } from 'node:child_process';
// Explicit legacy build even when the developer enabled login in .env.local.
const env = { ...process.env, VITE_AUTH_ENABLED: 'false' };
for (const args of [
  ['node_modules/vite/bin/vite.js', 'build'],
  ['node_modules/@playwright/test/cli.js', 'test'],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
