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
        runtimeCaching: [
          // Cacheja els GET de /orders durant 5 minuts perquè la llista i la
          // pantalla d'edició es puguin obrir sense connexió.
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/orders'),
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'orders-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Les mutacions (POST/PUT/DELETE) NO les intercepta el service worker:
          // quan no hi ha xarxa, fetch falla amb un TypeError i la cua offline de
          // l'app (utils/offlineQueue.js) les desa i les reenvia en reconnectar.
          // Així no depenem de la Background Sync API, poc fiable i sense suport
          // a iOS/Safari.
        ],
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