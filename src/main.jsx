import './polyfills'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
// The typeface arrives on its own, not in the stylesheet the first paint
// waits on (120 @font-face rules, 24 kB compressed). Until it does, text
// is in the system face — as it already was while the font files loaded.
import('./fonts.css').catch(() => {})
import { startLanguage } from './i18n'
import './hooks/useInstall'
import { applyTextSize, readTextSize } from './textSize'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'
import Root from './Root.jsx'

// The reader's text size, before the first paint.
applyTextSize(readTextSize())

// The first tile cache held opaque responses (see vite.config.js): served
// to a CORS request they draw as blank squares, for up to a fortnight.
if (typeof caches !== 'undefined') caches.delete('kfm-tiles').catch(() => {})

// The reader's language is loaded before the first paint, so the app does
// not open in English and then switch. English needs no fetch; if another
// language cannot be fetched the app opens in English rather than not at all.
// …but not for long: on a slow first visit the app opens in English after
// 2.5 s and switches when the language arrives.
const patience = new Promise(resolve => setTimeout(resolve, 2500))
Promise.race([startLanguage().catch(() => {}), patience]).then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <AppErrorBoundary>
        <Root />
      </AppErrorBoundary>
    </StrictMode>,
  )
})
