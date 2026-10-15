import { defineConfig } from '@playwright/test';
import config from './playwright.auth.config';
export default defineConfig({
  ...config,
  timeout: 60000,
  use: { ...config.use, baseURL: 'http://localhost:4180' },
  outputDir: 'test-results/auth-pwa',
  webServer: {
    command: 'node scripts/serve-auth-test.mjs',
    url: 'http://localhost:4180',
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      VITE_AUTH_ENABLED: 'true',
      VITE_FIREBASE_API_KEY: 'demo-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-belahora.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-belahora',
      VITE_FIREBASE_APP_ID: 'demo-app',
      VITE_FIREBASE_AUTH_EMULATOR_URL: '',
    },
  },
});
