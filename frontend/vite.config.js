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
          // 1. Cachea los GET de /orders durante 5 minutos
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/orders'),
            handler: 'NetworkFirst',
            method: 'GET', // Específicamos el método
            options: {
              cacheName: 'orders-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 2. Encola los POST cuando no hay red
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/orders'),
            handler: 'NetworkOnly', // Usamos NetworkOnly para mutaciones
            method: 'POST',
            options: {
              backgroundSync: {
                name: 'orders-queue',
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
          // 3. Encola los PUT cuando no hay red
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/orders'),
            handler: 'NetworkOnly',
            method: 'PUT',
            options: {
              backgroundSync: {
                name: 'orders-queue',
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
          // 4. Encola los DELETE cuando no hay red
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/orders'),
            handler: 'NetworkOnly',
            method: 'DELETE',
            options: {
              backgroundSync: {
                name: 'orders-queue',
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          }
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