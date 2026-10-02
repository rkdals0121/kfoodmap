import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import 'leaflet/dist/leaflet.css'
import './index.css'
import { startLanguage } from './i18n'
import App from './App.jsx'

// The reader's language is loaded before the first paint, so the app does
// not open in English and then switch. English needs no fetch; if another
// language cannot be fetched the app opens in English rather than not at all.
// …but not for long: on a slow first visit the app opens in English after
// 2.5 s and switches when the language arrives.
const patience = new Promise(resolve => setTimeout(resolve, 2500))
Promise.race([startLanguage().catch(() => {}), patience]).then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
})
