import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { statSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { clientModule, placeDataFile } from './scripts/lib/client-data.mjs'

// This file always sits at the project root, so its own location -- not
// process.cwd() -- is the reliable way to find .env.local. cwd() only
// happens to equal the project root when Vite is launched from inside the
// project; the controller launches it with the project path as an
// argument from an unrelated directory, where cwd()-based lookup silently
// finds nothing.
const projectRoot = dirname(fileURLToPath(import.meta.url))

// The on-demand auth chunk: src/data/auth-client.js and, through it, all of
// @supabase/auth-js. Both service-worker rules below key off this one name --
// one to keep it OUT of the precache, one to cache it at runtime once it has
// actually been fetched -- so the name is written once here rather than twice
// where they are used.
//
// The name is not a convention, it is load-bearing: rename
// src/data/auth-client.js, or let rolldown change how it names async chunks,
// and BOTH rules stop matching silently -- the chunk rejoins the precache
// (undoing the whole point of loading it on demand) and stops being cached at
// runtime. assertAuthChunkName() below turns that into a build failure.
const AUTH_CHUNK_SOURCE = 'src/data/auth-client.js'
const AUTH_CHUNK_GLOB = 'assets/auth-client-*.js'
const AUTH_CHUNK_URL = /\/assets\/auth-client-[^/]*\.js$/

// Fails the build if the emitted auth chunk is not where the two
// service-worker rules above are looking. Deliberately a build-time
// assertion rather than a test: a test over dist/sw.js would need a build to
// have already happened and would pass vacuously on a fresh clone, and
// deriving the name from a manualChunks entry would move the coupling rather
// than guard it. This runs on every `npm run build` and catches a rename, a
// rolldown chunk-naming change, and a refactor that splits or inlines the
// module.
function assertAuthChunkName() {
  return {
    name: 'kfm-assert-auth-chunk',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(
        item => item.type === 'chunk'
          && Object.keys(item.modules ?? {}).some(id => id.replaceAll('\\', '/').endsWith(AUTH_CHUNK_SOURCE)),
      );
      if (chunks.length !== 1) {
        this.error(
          `expected exactly one chunk containing ${AUTH_CHUNK_SOURCE}, found ${chunks.length}. `
          + 'The service-worker rules in vite.config.js (globIgnores + runtimeCaching) key off that '
          + 'one chunk; if it is inlined into the entry the library is back on the first-paint path.',
        );
      }
      const [chunk] = chunks;
      if (!AUTH_CHUNK_URL.test(`/${chunk.fileName}`)) {
        this.error(
          `the auth chunk is emitted as "${chunk.fileName}", which ${AUTH_CHUNK_URL} does not match. `
          + 'globIgnores would stop excluding it from the precache and runtimeCaching would stop '
          + `caching it, both silently. Update AUTH_CHUNK_SOURCE / AUTH_CHUNK_GLOB / AUTH_CHUNK_URL `
          + 'together, or rename the module back.',
        );
      }
    },
  };
}

// Dev only: Vite does not serve api/, so mount the same handler at the
// same path. apply: 'serve' keeps it out of every build.
// Ships src/data/restaurants.js to the browser without its `evidence` text
// and serves each place's full record at /place-data/<id>.json — see
// scripts/lib/client-data.mjs for why. The data file is plain ESM (the QA
// scripts import it the same way), so it is loaded in Node and re-emitted.
// Runs in dev too, so dev shows exactly what production ships.
const RESTAURANTS_FILE = join(projectRoot, 'src', 'data', 'restaurants.js')
function clientData() {
  let cached = null
  // Re-import only when the file changes; a fresh query string defeats
  // Node's module cache for that one reload.
  const loadRestaurants = async () => {
    const mtime = statSync(RESTAURANTS_FILE).mtimeMs
    if (cached?.mtime !== mtime) {
      const mod = await import(`${pathToFileURL(RESTAURANTS_FILE).href}?t=${mtime}`)
      const { isQuarantined } = await import('./src/data/verification.js')
      cached = { mtime, all: mod.restaurants, active: mod.restaurants.filter(r => !isQuarantined(r)) }
    }
    return cached
  }
  const isRestaurantsModule = (id) => id.split('?')[0].replaceAll('\\', '/') === RESTAURANTS_FILE.replaceAll('\\', '/')
  return {
    name: 'kfm-client-data',
    enforce: 'pre',
    async load(id, options) {
      if (options?.ssr || !isRestaurantsModule(id)) return null
      this.addWatchFile(RESTAURANTS_FILE)
      return clientModule((await loadRestaurants()).all)
    },
    async generateBundle() {
      for (const r of (await loadRestaurants()).active) {
        this.emitFile({ type: 'asset', ...placeDataFile(r) })
      }
    },
    configureServer(server) {
      server.middlewares.use('/place-data', async (req, res, next) => {
        const m = /^\/([a-z0-9-]+)\.json$/.exec(req.url ?? '')
        if (!m) return next()
        const r = (await loadRestaurants()).active.find(x => x.id === m[1])
        if (!r) { res.statusCode = 404; return res.end() }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(placeDataFile(r).source)
      })
    },
  }
}

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
    clientData(),
    apiDevServer(),
    assertAuthChunkName(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'K-Food Map',
        short_name: 'K-Food Map',
        description: 'Vegan and halal places across Korea, each dietary claim marked with how sure we are.',
        theme_color: '#FFFFFF',
        // The loading screen's and the app's own grey: white here flashed
        // white, then grey, as an installed app opened.
        background_color: '#F7F7F8',
        display: 'standalone',
        id: '/',
        scope: '/',
        lang: 'en',
        start_url: '/',
        // Long-press the home-screen icon: the two things worth reaching in
        // one move — the card to show staff, and the saved places.
        shortcuts: [
          { name: 'Korean cards to show staff', short_name: 'Staff cards', url: '/cards' },
          { name: 'Saved places', short_name: 'Journal', url: '/journal' },
        ],
        // Drawn from scripts/icons/*.svg by scripts/app-icons.mjs.
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // Default globPatterns only match js/wasm/css/html -- the SVG
        // illustrations under public/images/ are the app's only imagery
        // (every restaurant's photo/coverImage is null today) and would
        // otherwise render as broken images on a cold offline start.
        // NOTE: this also matches dist/place/**/*.html if that directory
        // exists at build time -- it doesn't today (prerender-places.mjs
        // runs after this manifest is finalized, see HANDOFF §2.1), but
        // if the build script's ordering ever changes, re-check this.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // The main chunk carries the place data and crossed workbox's 2 MiB
        // default at 566 places (2.11 MB raw, ~390 kB gzip — 2026-09-29).
        // Past the limit workbox silently leaves it out of the precache and
        // the app no longer opens offline, and vite-plugin-pwa fails the
        // build instead. The limit is on raw bytes; what travels is gzip.
        // 4 MiB leaves room for roughly twice today's data; when it is hit
        // again, split the data out of the entry chunk rather than raising
        // it further.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // The auth chunk (src/data/auth-client.js + @supabase/auth-js, ~100
        // kB raw / ~23 kB gzip) is deliberately NOT precached. Precaching it
        // would hand the bytes straight back: the whole point of loading it
        // on demand is that a visitor who never signs in never pays for it,
        // and a precache downloads it for everyone the moment the service
        // worker installs — off the first-paint path, but on the same
        // metered connection.
        //
        // Not precaching it is only half the rule, though. With nothing else,
        // the chunk would fall back to whatever Cache-Control the host sends
        // and be unavailable offline even to someone who had already
        // downloaded it — so a signed-in visitor would re-fail on every
        // offline start, not just the first. The CacheFirst route below is
        // the other half.
        //
        // These two options are a pair and both key off the same filename,
        // which is why they sit together. Rename src/data/auth-client.js and
        // both stop matching: the chunk silently returns to the precache and
        // the runtime route silently stops caching it.
        // og/: share images for crawlers. Nothing in the app shows them, and
        // precached they were 421 kB every first visitor downloaded.
        globIgnores: [AUTH_CHUNK_GLOB, 'og/**'],
        // Ordered auth chunk first, then the fonts, so this rule stays next
        // to the globIgnores it completes.
        //
        // StaleWhileRevalidate, NOT CacheFirst, and the reason is the captive
        // portal this file's sibling comments keep naming. A portal does not
        // answer 0 — it answers 200 with its own splash HTML. Any
        // cacheableResponse setting that admits 200 admits that, and under
        // CacheFirst the splash page would be written into this cache under
        // the hashed URL and served from it for up to a year, online or off.
        // The dynamic import would then fail on MIME forever and the hook's
        // retry could never recover it: not on reconnect, not on reload, only
        // on a deploy that changes the hash. That is worse than having no rule
        // at all, because portal responses usually carry no-store and the HTTP
        // cache declines them, while a service worker ignores Cache-Control
        // entirely.
        //
        // StaleWhileRevalidate gives up nothing here. The only thing
        // CacheFirst buys is not revalidating a copy that cannot be stale —
        // and the filename is content hashed, so a new build is a new name and
        // a new request anyway. It still serves from cache offline, which is
        // the whole point of the rule, and it repairs a poisoned entry on the
        // next online load.
        //
        // Matching on content type via cacheableResponse.headers was
        // considered and rejected: hosts serve `application/javascript` or
        // `text/javascript; charset=utf-8` and workbox compares header values
        // exactly, so the rule would silently stop caching on a host change.
        //
        // maxEntries is 2 rather than 1 so one superseded chunk survives a
        // deploy; a page still running the old entry chunk asks for the old
        // name, and evicting it the moment the new one lands would break
        // exactly the stale-asset case the hook's retry is there for.
        runtimeCaching: [
          // Map tiles a visitor has already seen stay for a fortnight, so the
          // streets around a saved place are still drawn underground or with
          // roaming off. Only what was viewed: OpenStreetMap's tile policy
          // forbids downloading areas in bulk. Only real (CORS) responses:
          // the tile layer asks with crossOrigin, because an opaque response
          // is charged against the storage quota as several megabytes.
          {
            urlPattern: ({ url }) => url.hostname === 'tile.openstreetmap.org',
            handler: 'CacheFirst',
            options: {
              // v2: the first version (a few hours on 2026-10-04) stored
              // opaque responses, which cannot answer today's CORS requests.
              // main.jsx deletes the old cache.
              cacheName: 'kfm-tiles-v2',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 14, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          // Per-place full records (evidence text), fetched when a detail
          // opens. Not precached — 270+ files nobody may open — but kept once
          // fetched so a place viewed online shows its evidence offline too.
          // StaleWhileRevalidate for the same captive-portal reason as the
          // auth chunk below: a poisoned entry is repaired on the next online
          // load, and the hook already treats unparseable JSON as "no evidence".
          {
            urlPattern: /\/place-data\/[a-z0-9-]+\.json$/,
            // The network first (3 s), the cache when it is slow or gone:
            // served cache-first, a corrected record (a claim lowered, a
            // place closed) showed its old self for one more visit.
            handler: 'NetworkFirst',
            options: {
              networkTimeoutSeconds: 3,
              cacheName: 'kfm-place-data',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: AUTH_CHUNK_URL,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'kfm-auth-chunk',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [200] },
            },
          },
          // The typeface (Pretendard GOV) is self-hosted: Vite emits its
          // unicode-range chunks under /assets/. They are left out of the
          // precache (globPatterns has no woff2 — 5.7 MB across 120 chunks,
          // most never needed) and cached as a page uses them instead.
          // CacheFirst is right for fonts: the file names are content-hashed
          // and never change.
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('.woff2'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'kfm-fonts',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    // Phones two or three years behind. Without a target the CSS was written
    // in the newest syntax: `@media (width<=767px)` is not read by iOS 16.3
    // or Chrome 103 and earlier, so the whole phone layout went unapplied
    // there, and the `100vh` fallbacks before `100dvh` were dropped.
    target: ['chrome100', 'safari15', 'ios15', 'firefox115'],
    rollupOptions: {
      output: {
        // Three files instead of one. The entry chunk used to carry the
        // place data (most of its bytes) and the libraries, so every deploy
        // that touched one line of code made a returning visitor — on
        // roaming data, in the street — download all ~400 kB gzip again.
        // Split by how often each part changes: the libraries almost never,
        // the places when data is edited, the app code on most deploys. The
        // three are still fetched together on a first visit (modulepreload)
        // and still precached; nothing is loaded later than before.
        //
        // The library list is explicit, not "everything in node_modules":
        // @supabase must stay out, in its on-demand auth chunk (see
        // assertAuthChunkName above, which fails the build if it moves).
        codeSplitting: {
          groups: [
            { name: 'places', test: /[\\/]src[\\/]data[\\/]restaurants\.js$/ },
            {
              name: 'vendor',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|leaflet|react-leaflet|@react-leaflet|i18next|react-i18next)[\\/]/,
            },
          ],
        },
      },
    },
  },
})
