/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  server: {
    // En Windows algunos editores guardan por reemplazo atómico y el watcher nativo pierde eventos.
    watch: { usePolling: true, interval: 250 },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        globIgnores: ['**/*cyrillic*', '**/*greek*', '**/*vietnamese*'],
        // los JSON de cartas (con descripciones largas) rondan 8–10 MB; se precachean para jugar offline
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
      },
      manifest: {
        name: 'SCP Gacha — Archivo Anómalo',
        short_name: 'SCP Gacha',
        description: 'Abre paquetes, colecciona expedientes de la Fundación SCP y enfréntalos en combate. Funciona sin conexión.',
        lang: 'es',
        theme_color: '#0b0d10',
        background_color: '#0b0d10',
        display: 'standalone',
        orientation: 'portrait',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
