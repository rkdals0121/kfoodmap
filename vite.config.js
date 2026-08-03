import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'K-Food Map',
        short_name: 'K-Food Map',
        description: 'A curated map of sustainable Korean dining in Seoul & Incheon.',
        theme_color: '#FFFFFF',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // The Inter webfont is a cross-origin @import (src/index.css:1), so
        // it can't be precached by globPatterns the way local assets are --
        // offline it silently fell back to system fonts (§7 #26). CacheFirst
        // is right for fonts specifically: they're immutable, so serving a
        // year-old cached copy is correct rather than stale. Option shapes
        // (handler/urlPattern/expiration/cacheableResponse) verified against
        // workbox-build@7.4.1's own type definitions, not assumed.
        //
        // statuses includes 0 to cover opaque (no-cors) responses -- gstatic
        // can serve those, and a 0 without this would be treated as
        // uncacheable, quietly defeating the whole rule.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Default globPatterns only match js/wasm/css/html -- the SVG
        // illustrations under public/images/ are the app's only imagery
        // (every restaurant's photo/coverImage is null today) and would
        // otherwise render as broken images on a cold offline start.
        // NOTE: this also matches dist/place/**/*.html if that directory
        // exists at build time -- it doesn't today (prerender-places.mjs
        // runs after this manifest is finalized, see HANDOFF §2.1), but
        // if the build script's ordering ever changes, re-check this.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
    }),
  ],
})
