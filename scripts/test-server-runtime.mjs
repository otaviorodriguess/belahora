import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

mkdirSync('work', { recursive: true });
const output = mkdtempSync(resolve('work/server-runtime-'));
const compile = spawnSync(
  process.execPath,
  [
    'node_modules/typescript/bin/tsc',
    '-p',
    'tsconfig.server.json',
    '--noEmit',
    'false',
    '--outDir',
    output,
  ],
  { encoding: 'utf8', windowsHide: true },
);
if (compile.status !== 0) throw new Error(compile.stdout + compile.stderr);
for (const [file, method, expectedStatus] of [
  ['agenda', 'POST', 401],
  ['booking', 'GET', 403],
]) {
  const { default: handler } = await import(pathToFileURL(resolve(output, `api/${file}.js`)));
  let status, payload;
  const res = {
    setHeader() {},
    status(value) {
      status = value;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    },
  };
  await handler({ method, headers: {}, query: { action: 'catalog', code: 'test' }, body: {} }, res);
  assert.equal(
    status,
    expectedStatus,
    `${file} should load in native Node ESM and reject unauthenticated access`,
  );
  assert.ok(payload.code);
}
console.log(
  'Both compiled API handlers load in native Node ESM and reject unauthenticated access.',
);
