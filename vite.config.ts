import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // GramJS expects a few Node globals (Buffer, process, util, os...).
    nodePolyfills({ globals: { Buffer: true, process: true, global: true } }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Switchboard',
        short_name: 'Switchboard',
        description: 'An unofficial Telegram client to sort hundreds of chats into workspaces.',
        theme_color: '#1d2a3a',
        background_color: '#e8ecf0',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  resolve: { dedupe: ['buffer'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 3000 },
})
