import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Cachea GET /orders durante 5 minutos (útil con mala cobertura)
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/orders') && !url.search.includes('method=POST'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'orders-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Encola los POST/PUT/DELETE cuando no hay red
        backgroundSync: {
          name: 'orders-queue',
          options: { maxRetentionTime: 24 * 60 },
        },
      },
      manifest: {
        name: 'Família Esteve Ràfols',
        short_name: 'Comandes',
        start_url: '/',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        lang: 'ca',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});