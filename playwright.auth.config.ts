import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'auth-local.spec.ts',
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5180',
    channel: 'chrome',
    headless: true,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  outputDir: 'test-results/auth',
  webServer: {
    command: 'npx vite --host localhost --port 5180 --strictPort',
    url: 'http://localhost:5180',
    reuseExistingServer: false,
    env: {
      VITE_AUTH_ENABLED: 'true',
      VITE_FIREBASE_API_KEY: 'demo-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-belahora.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-belahora',
      VITE_FIREBASE_APP_ID: 'demo-app',
      VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
    },
  },
});
