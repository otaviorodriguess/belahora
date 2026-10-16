import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: ['booking.spec.ts', 'demo.spec.ts', 'branding.spec.ts'],
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:4181',
    channel: 'chrome',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  outputDir: 'test-results/booking',
  webServer: {
    command: 'tsx scripts/serve-booking-test.ts',
    url: 'http://localhost:4181',
    timeout: 120000,
    env: {
      VITE_AUTH_ENABLED: 'true',
      VITE_CLOUD_AGENDA_ENABLED: 'true',
      VITE_FIREBASE_API_KEY: 'demo-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-belahora.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-belahora',
      VITE_FIREBASE_APP_ID: 'demo-app',
      VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
      VITE_FIRESTORE_EMULATOR: 'true',
      VITE_APPCHECK_SITE_KEY: 'test-key',
      VITE_PUBLIC_BOOKING_ORIGIN: 'http://localhost:4181',
      BOOKING_RATE_SECRET: 'local-test-only',
    },
  },
});
