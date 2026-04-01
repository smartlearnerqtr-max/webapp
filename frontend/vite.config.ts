import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['app-icon.svg'],
      manifest: {
        name: 'Bạn học thông minh',
        short_name: 'Bạn học',
        description: 'Webapp/PWA hỗ trợ học tập, giao tiếp AAC và theo dõi tiến độ học sinh.',
        theme_color: '#a78bfa',
        background_color: '#faf8ff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/app-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
        screenshots: [
          {
            src: '/app-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            form_factor: 'wide',
          },
          {
            src: '/app-icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            form_factor: 'narrow',
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
})
