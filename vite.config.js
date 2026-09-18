import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

// This file always sits at the project root, so its own location -- not
// process.cwd() -- is the reliable way to find .env.local. cwd() only
// happens to equal the project root when Vite is launched from inside the
// project; the controller launches it with the project path as an
// argument from an unrelated directory, where cwd()-based lookup silently
// finds nothing.
const projectRoot = dirname(fileURLToPath(import.meta.url))

// Dev only: Vite does not serve api/, so mount the same handler at the
// same path. apply: 'serve' keeps it out of every build.
function apiDevServer() {
  return {
    name: 'kfm-api-dev',
    apply: 'serve',
    configResolved(config) {
      // The dev-server process itself is started without --env-file, so
      // process.env.KAKAO_REST_API_KEY is undefined here even though
      // .env.local has it -- Vite only auto-exposes VITE_-prefixed vars to
      // the client. loadEnv's third argument ('') loads every var, not just
      // VITE_-prefixed ones, so the handler (which reads process.env
      // directly, same as it will in production) can find its key. Only
      // fill in what's missing: a variable the real environment already
      // set must win, never be overwritten by a .env file value.
      //
      // Narrowed to exactly the one var the handler reads: loadEnv's
      // empty-prefix form returns *everything* in .env.local, and copying
      // all of it into process.env would also pull SUPABASE_SERVICE_ROLE_KEY
      // into this dev process for no reason this plugin needs.
      const env = loadEnv(config.mode, projectRoot, '');
      const key = 'KAKAO_REST_API_KEY';
      if (!(key in process.env) && key in env) process.env[key] = env[key];
    },
    configureServer(server) {
      server.middlewares.use('/api/place-search', async (req, res, next) => {
        try {
          const { default: handler } = await server.ssrLoadModule('/api/place-search.js');
          const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
          // This object is a hand-built stand-in for Vercel's real request
          // object, so it must mirror everything the handler actually
          // reads -- not just what it read when this shim was written.
          // `method` was missing until the handler grew a method check
          // (405 guard) and every request here read as `undefined`,
          // rejecting valid GETs only in dev. Whatever the handler starts
          // reading next (a new header, a body, ...) must be added here
          // too, or dev and production silently diverge again.
          await handler(
            { method: req.method, url: req.url, headers: req.headers },
            { status: (code) => ({ json: (body) => send(code, body) }), setHeader: () => {} },
          );
        } catch (error) {
          // ssrLoadModule (or the handler itself) throwing must not hang
          // the request forever -- dev-only, so a bare 500 with a code is
          // enough; next(error) also hands it to Vite's own error overlay.
          console.error('kfm-api-dev: /api/place-search failed', error);
          if (res.headersSent) return next(error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ code: 'devServerError' }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    apiDevServer(),
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
