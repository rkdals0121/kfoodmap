import './polyfills'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import 'leaflet/dist/leaflet.css'
import './index.css'
import { startLanguage } from './i18n'
import './hooks/useInstall'
import { applyTextSize, readTextSize } from './textSize'
import App from './App.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'

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
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AppErrorBoundary>
    </StrictMode>,
  )
})
