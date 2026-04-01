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
        name: 'Ban hoc thong minh',
        short_name: 'Ban hoc',
        description:
          'Webapp/PWA ho tro hoc tap, giao tiep AAC va theo doi tien do hoc sinh.',
        theme_color: '#14532d',
        background_color: '#f4efe2',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/app-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
})
