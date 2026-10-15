import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'bela-hora-apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Bela Hora · Agenda de estética',
        short_name: 'Bela Hora',
        description: 'Sua agenda de atendimentos, com tempo para cuidar.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#85514f',
        background_color: '#faf8f5',
        icons: [
          { src: '/bela-hora-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/bela-hora-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/bela-hora-icon-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});


