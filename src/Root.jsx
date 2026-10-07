import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router'
import { useTranslation } from 'react-i18next'
import Prologue from './components/Prologue.jsx'
import { startup, firstVisit } from './startup'

// The map — its code and the places, most of what there is to download —
// is its own file. A first visit shows the welcome screen as soon as this
// small file is in, and fetches the map while that is read; any other
// visit asks for the map at once (index.html asks for its files beside
// this one, so nothing arrives later than it did).
let mapFile = null
const loadMap = () => {
  mapFile ??= import('./App.jsx').catch((error) => {
    // Once more, a moment later: a dropped connection is the usual cause.
    // A failure is not kept: the next call asks again.
    mapFile = null
    return new Promise(resolve => setTimeout(resolve, 1500)).then(() => import('./App.jsx')).catch(() => { throw error })
  })
  return mapFile
}
const welcome = firstVisit()
if (!welcome) loadMap()

// Start again, keeping the diet picked on the welcome screen: it is only
// in memory, and the next load is no longer a first visit. Carried in the
// address as the chips of a view are (filters.js viewHash), unless the
// address already names a view.
function startAgain() {
  try {
    if (startup.diet.length > 0 && !window.location.hash) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#f=${startup.diet.join(',')}`)
    }
  } catch { /* the address stays as it is */ }
  window.location.reload()
}

// Between "Open the map" and the map, when it is pressed before the map
// has arrived: the screen index.html shows while the first file loads.
// `failed`: the map's file could not be fetched — said as a slow or lost
// connection, which is what it nearly always is, with a way to try again.
function OpeningMap({ failed }) {
  const { t } = useTranslation()
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 20000)
    return () => clearTimeout(timer)
  }, [])
  const stuck = failed || slow
  return (
    <main className="opening-map">
      {/* The mark of the screen index.html shows first, so the two read as one. */}
      <svg width="56" height="56" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#087F5B"/><g transform="translate(256 256) scale(1.0) translate(-256 -256)"><path d="M17 42.5C17 42.5 31.5 26.4 31.5 15.6C31.5 7.6 25 1.5 17 1.5C9 1.5 2.5 7.6 2.5 15.6C2.5 26.4 17 42.5 17 42.5Z" transform="translate(133.6 97.6) scale(7.2)" fill="#FFFFFF"/><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 1 0 10.5 10.5Z" transform="translate(188.8 141.4) scale(5.6)" fill="#087F5B"/><path d="M20 4c0 8.5-5.5 15-15 15C5 10.5 11.5 4 20 4Z" transform="translate(252.8 165.4) scale(2.0)" fill="#087F5B"/></g></svg>
      <p className="opening-map__name">K-Food Map</p>
      <p role="status" className="opening-map__status">{t(stuck ? 'app.loadingSlow' : 'app.loadingMap')}</p>
      {stuck && <button type="button" className="opening-map__retry" onClick={startAgain}>{t('app.tryAgain')}</button>}
    </main>
  )
}

export default function Root() {
  const [greeting, setGreeting] = useState(welcome)
  // The map, once its file is in ({ App }), or that it could not be had
  // ({ failed }). Kept in state rather than read through lazy(): pressed
  // after the map has arrived, "Open the map" goes straight to it, with no
  // loading screen for a frame in between.
  const [map, setMap] = useState(null)
  const fetchMap = useCallback(() => {
    loadMap().then(
      (file) => setMap({ App: file.default }),
      () => setMap({ failed: true }),
    )
  }, [])
  // On a first visit, after the welcome screen has been drawn, not before:
  // on a slow connection the map's files would share the line with it.
  useEffect(() => { fetchMap() }, [fetchMap])
  if (greeting) {
    return (
      <Prologue
        onComplete={(diet) => {
          // Storage can be refused (private mode, a full disk): the welcome
          // screen then greets again next time, and the map still opens.
          try { localStorage.setItem('kfm-prologue', 'true') } catch { /* not remembered */ }
          startup.welcomed = true
          startup.diet = Array.isArray(diet) ? diet : []
          // The connection dropped while the welcome screen was being read,
          // and may be back by now: asked for once more.
          if (map?.failed) { setMap(null); fetchMap() }
          setGreeting(false)
        }}
      />
    )
  }
  if (!map?.App) return <OpeningMap failed={Boolean(map?.failed)} />
  return (
    <BrowserRouter>
      <map.App />
    </BrowserRouter>
  )
}
