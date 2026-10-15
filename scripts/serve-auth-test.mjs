// Test server only: compile the real PWA without a production emulator bypass.
import { build, preview } from 'vite';
import { cp, access, readFile } from 'node:fs/promises';
import path from 'node:path';
if (process.env.VITE_FIREBASE_PROJECT_ID !== 'demo-belahora')
  throw new Error('Test server requires demo project');
await build({ build: { outDir: 'work/auth-pwa-dist' } });
// Optional historical fixture: local recovery copy made before implementation.
// The upgrade test is skipped when that copy is absent (e.g. a fresh checkout).
const oldRoot = path.resolve('work/firebase-auth-original');
let oldAvailable = false;
try {
  await access(path.join(oldRoot, 'src/main.tsx'));
  oldAvailable = true;
} catch {
  /* No historical fixture. */
}
if (oldAvailable) {
  await cp('index.html', path.join(oldRoot, 'index.html'));
  await cp('public', path.join(oldRoot, 'public'), { recursive: true });
  await build({
    root: oldRoot,
    configFile: path.resolve('vite.config.ts'),
    build: { outDir: 'dist' },
  });
}
let serveOld = false;
const oldDist = path.join(oldRoot, 'dist');
const mime = {
  '.js': 'application/javascript',
  '.html': 'text/html',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
await preview({
  build: { outDir: 'work/auth-pwa-dist' },
  preview: { host: 'localhost', port: 4180, strictPort: true },
  plugins: [
    {
      name: 'test-historical-upgrade',
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/__test_upgrade__/old' || req.url === '/__test_upgrade__/new') {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end();
              return;
            }
            serveOld = req.url.endsWith('/old') && oldAvailable;
            res.statusCode = oldAvailable ? 200 : 404;
            res.end();
            return;
          }
          if (!serveOld) {
            next();
            return;
          }
          const pathname = new URL(req.url || '/', 'http://localhost').pathname;
          const target = path.resolve(oldDist, '.' + (pathname === '/' ? '/index.html' : pathname));
          if (!target.startsWith(oldDist + path.sep)) {
            res.statusCode = 403;
            res.end();
            return;
          }
          void readFile(target)
            .then((bytes) => {
              res.setHeader(
                'Content-Type',
                mime[path.extname(target)] || 'application/octet-stream',
              );
              res.setHeader('Cache-Control', 'no-store');
              res.end(bytes);
            })
            .catch(() => {
              res.statusCode = 404;
              res.end();
            });
        });
      },
    },
  ],
});
