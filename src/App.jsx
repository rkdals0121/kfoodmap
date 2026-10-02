import React, { useState, useMemo, useEffect } from 'react';
import { Routes, Route, useParams, useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { restaurants } from './data/restaurants';
import MapComponent from './components/MapComponent';
import MapErrorBoundary from './components/MapErrorBoundary';
import { prefetchPlaceRecords } from './hooks/usePlaceRecord';
import FilterBar from './components/FilterBar';
import BottomSheetList from './components/BottomSheetList';
import RestaurantDetail from './components/RestaurantDetail';
import TabBar from './components/TabBar';
import TabPanel from './components/TabPanel';
import JournalPanel from './components/JournalPanel';
import Prologue from './components/Prologue';
import SubmitSheet from './components/SubmitSheet';
import PrivacySheet from './components/PrivacySheet';
import StaffCardSheet from './components/StaffCardSheet';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import useAppUpdate from './hooks/useAppUpdate';
import { MAP_CENTER, getOpenStatus } from './utils';
import { readPosition, readError } from './data/locate';
import { journeys } from './data/journeys';
import { journeyNav } from './data/journey-nav';
import { matchesDietary, isQuarantined } from './data/verification';
import { resolvePlace } from './data/leads';
import { loadLocalPassport, saveLocalPassport, savedOnly } from './data/passport';
import usePassportSync from './hooks/usePassportSync';
import { DIETARY_CHIPS, TRAIT_GROUPS, matchesSearch, OPEN_NOW, SAVED_ONLY, FULLY_VEGAN, matchesFullyVegan, SHARED_LIST, parseSharedList } from './filters';
import './index.css';

// Selecting anything on the sustainability axis — the group chip or either
// member — turns the list into a lens: each card states, in the restaurant's
// own recorded words, why it is here. Nothing new is written for this; the
// line is the esg_point already shown on the detail page.
const SUSTAINABILITY_AXIS = ['Sustainability', ...TRAIT_GROUPS.Sustainability];

// Quarantined records (existence itself unconfirmed) are excluded from every
// discovery surface — map, search, cards, Journal — at this single point.
const activeRestaurants = restaurants.filter(r => !isQuarantined(r));

const TAB_PATH = { map: '/', discover: '/discover', journal: '/journal', profile: '/profile' };
const PATH_TAB = { '/discover': 'discover', '/journal': 'journal', '/profile': 'profile' };

function AppShell() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const { updateReady, reload } = useAppUpdate();
  const [searchQuery, setSearchQuery] = useState('');
  // A shared list (/?list=a,b,c) opens the map on those places only, as a
  // filter the reader can close. Read once, on arrival.
  const [sharedIds] = useState(() => parseSharedList(
    new URLSearchParams(window.location.search).get('list'),
    activeRestaurants.map(r => r.id),
  ));
  const [selectedFilters, setSelectedFilters] = useState(() => (sharedIds.length > 0 ? [SHARED_LIST] : []));
  // The URL is the source of truth for which restaurant is open — no
  // separate state to keep in sync. activeRestaurants already excludes
  // quarantined places, so an id that's quarantined or simply doesn't
  // exist both resolve to null here, and the effect below sends it home.
  const selectedRestaurant = useMemo(
    () => (id ? activeRestaurants.find(r => r.id === id) ?? null : null),
    [id],
  );
  const focusStory = Boolean(location.state?.focusStory);
  const focusDirections = Boolean(location.state?.focusDirections);
  const isSubmit = location.pathname === '/submit';
  const isPrivacy = location.pathname === '/privacy';
  // /cards: Korean text to show restaurant staff (StaffCardSheet).
  const isCards = location.pathname === '/cards';
  const submitPlace = useMemo(
    () => (isSubmit ? resolvePlace(new URLSearchParams(location.search).get('place'), activeRestaurants) : null),
    [isSubmit, location.search],
  );

  useEffect(() => {
    // An unknown or withdrawn place: say so on the map instead of silently
    // showing the home screen.
    if (id && !selectedRestaurant) navigate('/', { replace: true, state: { missingPlace: id } });
  }, [id, selectedRestaurant, navigate]);
  // State is the whole passport, tombstones included — a tombstone is the
  // only record that an unsave happened, and dropping it here would let the
  // next sync resurrect the place. Children still receive only saved entries.
  const [entries, setEntries] = useState(loadLocalPassport);
  // Tabs have addresses (/discover, /journal, /profile), so reload and the
  // phone's Back button keep you where you were. A place, the report form
  // or the privacy page opens over whichever tab is active and returns to it.
  // A place or sheet opened from the app records the tab it opened over in
  // history state, so a reload there keeps that tab behind it.
  const [activeTab, setActiveTab] = useState(() => PATH_TAB[location.pathname] ?? location.state?.tab ?? 'map');
  useEffect(() => {
    if (PATH_TAB[location.pathname]) setActiveTab(PATH_TAB[location.pathname]);
    else if (location.pathname === '/') setActiveTab('map');
  }, [location.pathname]);
  const tabPath = TAB_PATH[activeTab] ?? '/';
  const selectTab = (tab) => navigate(TAB_PATH[tab] ?? '/');
  // Below 768px a non-map tab covers the whole map. The map is then made
  // inert, so Tab never lands on a pin nobody can see (WCAG 2.4.11). From
  // 768px up the map stays visible beside the panel and stays usable.
  const [isWide, setIsWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(min-width: 768px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(min-width: 768px)');
    if (!mq) return undefined;
    const onChange = () => setIsWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const mapCovered = activeTab !== 'map' && !isWide;
  // The submit and privacy sheets are modal, and so is the detail on a
  // phone, where it covers the map: while one is open what lies behind it is
  // inert, so Tab stays inside. From 768px up the detail docks beside a
  // live map instead, and is not modal.
  const modalOpen = (Boolean(selectedRestaurant) && !isWide) || isSubmit || isPrivacy || isCards;
  const [mapCenter, setMapCenter] = useState(MAP_CENTER);
  // "My location" (data/locate.js): asked once per tap, kept in memory for
  // this visit only. `at` changes with every answer so the map knows to go
  // there again when the button is pressed a second time.
  const [userLocation, setUserLocation] = useState(null);
  const [locateState, setLocateState] = useState('idle'); // idle | asking | located | outside | denied | unavailable
  const locate = () => {
    if (!('geolocation' in navigator)) { setLocateState('unavailable'); return; }
    setLocateState('asking');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const answer = readPosition(position);
        setLocateState(answer.state);
        setUserLocation(answer.state === 'located' ? { ...answer.location, at: Date.now() } : null);
      },
      (error) => { setLocateState(readError(error).state); setUserLocation(null); },
      // A recent fix is fine for "what is near me"; do not hold the radio on.
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sheetState, setSheetState] = useState(1); // 0: Collapsed, 1: Half, 2: Expanded
  const [prologueCompleted, setPrologueCompleted] = useState(
    () => localStorage.getItem('kfm-prologue') === 'true'
  );

  // Touch states for mobile bottom sheet swipe
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchEndY, setTouchEndY] = useState(null);

  const handleTouchStart = (e) => setTouchStartY(e.targetTouches[0].clientY);
  const handleTouchMove = (e) => setTouchEndY(e.targetTouches[0].clientY);
  const handleTouchEnd = () => {
    if (!touchStartY || !touchEndY) return;
    const distance = touchStartY - touchEndY;
    const swipeThreshold = 50;

    if (distance > swipeThreshold) {
      // Swiped up -> expand
      setSheetState(s => Math.min(s + 1, 2));
    } else if (distance < -swipeThreshold) {
      // Swiped down -> collapse
      setSheetState(s => Math.max(s - 1, 0));
    }
    setTouchStartY(null);
    setTouchEndY(null);
  };

  // Single choke point for every path that opens detail (map pin, card,
  // Journal stamp/next-stop) — a quarantined restaurant is a no-op here
  // rather than rendering unverified detail.
  // Opening a place from inside the app marks the entry (fromApp) so Close
  // can go back instead of stacking a new history entry — otherwise Android's
  // Back reopened the place just closed. A second place opened over the
  // first replaces it, so Close always returns to the tab.
  const openPlace = (r, extra = {}) => {
    if (isQuarantined(r)) return;
    if (r.id === id && !extra.focusStory && !extra.focusDirections) return;
    navigate(`/place/${r.id}`, { replace: Boolean(id), state: { fromApp: true, tab: activeTab, ...extra } });
  };
  const closePlace = () => (location.state?.fromApp ? navigate(-1) : navigate(tabPath));
  const openDetail = (r) => openPlace(r);
  // A place opened from a journey (Discover) remembers which journey and
  // which stop, so the detail can offer the stop before and after. A stale
  // link, or a journey that lost a stop, is simply no journey.
  const journeyState = location.state?.journey;
  const journeyStops = useMemo(() => {
    const j = journeys.find(x => x.id === journeyState?.id);
    if (!j) return null;
    const stops = j.stopIds.map(sid => restaurants.find(r => r.id === sid));
    return stops.every(p => p && !isQuarantined(p)) ? { journey: j, stops } : null;
  }, [journeyState?.id]);
  const journey = journeyStops && journeyStops.stops[journeyState.index]?.id === id
    ? journeyNav(journeyStops.journey, journeyStops.stops, journeyState.index)
    : null;
  const openJourneyStop = (place, index) => openPlace(place, { tab: 'discover', journey: { id: journeyState.id, index } });
  const openStory = (r) => openPlace(r, { focusStory: true });
  // The card's directions button opens the place at its map-app buttons
  // (Naver and Kakao first), rather than straight to Google.
  const openDirections = (r) => openPlace(r, { focusDirections: true });

  // Local first, always: the device is written before any request goes out
  // and is never rolled back by one that fails.
  useEffect(() => {
    saveLocalPassport(entries);
  }, [entries]);

  const bookmarks = useMemo(() => savedOnly(entries), [entries]);
  const bookmarkedIds = useMemo(() => bookmarks.map(b => b.id), [bookmarks]);
  // Saved places should open fully offline, detail included.
  useEffect(() => { prefetchPlaceRecords(bookmarkedIds); }, [bookmarkedIds]);
  const visitedIds = useMemo(
    () => bookmarks.filter(b => b.visitedAt !== null).map(b => b.id),
    [bookmarks],
  );

  const { session, googleReady, signIn, signOut, deleteRecords, lastSyncFailed, sessionEnded, signInFailed } =
    usePassportSync({ entries, setEntries, isOnline });
  const sustainabilityLens = useMemo(
    () => selectedFilters.some(f => SUSTAINABILITY_AXIS.includes(f)),
    [selectedFilters],
  );

  const handleToggleFilter = (filter) => {
    setSelectedFilters(prev =>
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
    if (id) navigate(tabPath, { replace: true });
  };

  const handleToggleBookmark = (placeId) => {
    // Unsaving a visited place also drops its visit (and its Journal seal),
    // so ask first rather than erase a record silently.
    const current = entries.find(e => e.id === placeId);
    if (current && current.savedAt !== null && current.visitedAt !== null
      && !window.confirm(t('journal.unsaveVisitedConfirm'))) return;
    const now = Date.now();
    setEntries(prev => {
      const held = prev.find(e => e.id === placeId);
      if (!held || held.savedAt === null) {
        const fresh = { id: placeId, savedAt: now, visitedAt: null, updatedAt: now };
        return held ? prev.map(e => (e.id === placeId ? fresh : e)) : [...prev, fresh];
      }
      // Unsave: keep the row as a tombstone. The visit goes with the save,
      // exactly as it did when the entry was dropped outright.
      return prev.map(e => (e.id === placeId ? { ...e, savedAt: null, visitedAt: null, updatedAt: now } : e));
    });
  };

  // Marking a visit only ever edits an entry that is already saved, so the
  // invariant (visitedAt implies savedAt) holds by construction — this can
  // never create a record, and a tombstone is never revived into one.
  // "Been here" on a place not yet saved saves it and marks the visit in one
  // tap (a visit lives on a saved entry), rather than a disabled button
  // that never said why.
  // "Save all" on a shared list: every place not already saved, in one go.
  // An unsaved place's tombstone is revived, as a tap on its heart would.
  const saveMany = (ids) => {
    const now = Date.now();
    setEntries(prev => {
      const next = prev.map(e => (ids.includes(e.id) && e.savedAt === null
        ? { ...e, savedAt: now, visitedAt: null, updatedAt: now }
        : e));
      const held = new Set(prev.map(e => e.id));
      return [...next, ...ids.filter(pid => !held.has(pid)).map(pid => ({ id: pid, savedAt: now, visitedAt: null, updatedAt: now }))];
    });
  };
  const closeSharedList = () => {
    setSelectedFilters(prev => prev.filter(f => f !== SHARED_LIST));
    navigate('/', { replace: true });
  };

  const handleToggleVisited = (placeId) => {
    // Taking a visit back removes its date and Journal seal: ask, as unsave does.
    const current = entries.find(e => e.id === placeId);
    if (current && current.savedAt !== null && current.visitedAt !== null
      && !window.confirm(t('journal.unvisitConfirm'))) return;
    const now = Date.now();
    setEntries(prev => {
      const held = prev.find(e => e.id === placeId);
      if (!held || held.savedAt === null) {
        const fresh = { id: placeId, savedAt: now, visitedAt: now, updatedAt: now };
        return held ? prev.map(e => (e.id === placeId ? fresh : e)) : [...prev, fresh];
      }
      return prev.map(e => (e.id === placeId
        ? { ...e, visitedAt: e.visitedAt === null ? now : null, updatedAt: now }
        : e));
    });
  };

  // "Open now" is answered by the clock, so while it is on the list is
  // re-asked every minute (a place closing at 9:00 leaves at 9:00).
  const openNowOn = selectedFilters.includes(OPEN_NOW);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (!openNowOn) return undefined;
    setClock(Date.now());
    const id = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(id);
  }, [openNowOn]);

  // unknownHours: places that match everything else but have no recorded
  // hours for now — hidden by "Open now", and the list says how many.
  const { filteredRestaurants, unknownHours } = useMemo(() => {
    const now = new Date(clock);
    let unknown = 0;
    const list = activeRestaurants.filter(r => {
      // 1. Filter chips (AND across chips). A dietary chip only matches on
      // evidence — an unknown dietary record never matches, so we never send
      // someone somewhere we can't vouch for. A group chip ORs within itself.
      const matchesChips = selectedFilters.every(f => {
        if (f === OPEN_NOW) return true; // asked last, below
        if (f === SAVED_ONLY) return bookmarkedIds.includes(r.id);
        if (f === SHARED_LIST) return sharedIds.includes(r.id);
        if (f === FULLY_VEGAN) return matchesFullyVegan(r);
        if (DIETARY_CHIPS.includes(f)) return matchesDietary(r, f);
        const group = TRAIT_GROUPS[f];
        return group ? r.traits.some(t => group.includes(t)) : r.traits.includes(f);
      });

      // 2. Free-text search: name, vibe, area and street address.
      if (!matchesChips || !matchesSearch(r, searchQuery)) return false;
      if (!openNowOn) return true;
      const status = getOpenStatus(r.hours, now);
      if (status === null) unknown += 1;
      // Open but past last order is no use to someone who wants to eat now.
      return status?.open === true && status.orderable !== false;
    });
    return { filteredRestaurants: list, unknownHours: unknown };
  }, [selectedFilters, searchQuery, openNowOn, clock, bookmarkedIds, sharedIds]);

  if (!prologueCompleted) {
    return (
      <Prologue 
        onComplete={() => {
          localStorage.setItem('kfm-prologue', 'true');
          setPrologueCompleted(true);
        }} 
      />
    );
  }

  return (
    <main className={`app-shell ${isSidebarCollapsed ? 'is-collapsed' : ''}`}>
      {/* The page's one H1, for screen readers and outlines; the map screen
          has no visible title. */}
      <h1 className="visually-hidden">K-Food Map</h1>
      {/* The map holds hundreds of focusable pins; the same places are in
          the list, one Tab away with this link. */}
      {activeTab === 'map' && <a className="skip-link" href="#place-list">{t('app.skipToList')}</a>}
      {/* Map is now at the base level */}
      <div className="map-region" inert={mapCovered || modalOpen || undefined}>
        {!isOnline && (
          <div className="offline-banner" role="status">
            {t('app.offline')}
          </div>
        )}
        {/* Only offered when the page was already in use as the new version
            arrived; an untouched page reloads itself (useAppUpdate). */}
        {updateReady && (
          <button type="button" className="update-banner" onClick={reload}>
            {t('app.updateReady')}
          </button>
        )}
        <MapErrorBoundary>
          <MapComponent
            restaurants={filteredRestaurants}
            onMarkerClick={openDetail}
            selectedId={selectedRestaurant?.id}
            onCenterChange={setMapCenter}
            searchQuery={searchQuery}
            fitAll={selectedFilters.includes(SAVED_ONLY) || selectedFilters.includes(SHARED_LIST)}
            userLocation={userLocation}
            locateState={locateState}
            onLocate={locate}
          />
        </MapErrorBoundary>
      </div>

      <div className={`sidebar-region ${activeTab === 'map' ? `sheet-state-${sheetState}` : 'non-map-tab'}`} inert={modalOpen || undefined}>
        {/* Render Map Items ONLY when activeTab is 'map' */}
        {activeTab === 'map' && (
          <>
            {/* Mobile handle and header wrapped for touch events */}
            <div 
              className="sheet-header-drag-area"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Dragging is not the only way to resize the sheet (WCAG 2.5.7):
                  the handle is a button that steps through the three heights. */}
              <button
                type="button"
                className="sheet-handle-area"
                aria-label={t(['app.sheetExpand', 'app.sheetExpandFull', 'app.sheetCollapse'][sheetState])}
                onClick={() => setSheetState(s => (s + 1) % 3)}
              >
                <span className="sheet-handle-bar" aria-hidden="true" />
              </button>

              {/* Search + dietary filters */}
              <FilterBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedFilters={selectedFilters}
                onToggleFilter={handleToggleFilter}
              />
            </div>

            {/* Restaurant list */}
            <section className="list-region" id="place-list" tabIndex={-1} aria-label={t('app.restaurantList')}>
              <BottomSheetList
                restaurants={filteredRestaurants}
                mapCenter={mapCenter}
                userLocation={userLocation}
                bookmarkedIds={bookmarkedIds}
                onRestaurantClick={openDetail}
                onReadStory={openStory}
                onDirections={openDirections}
                onToggleBookmark={handleToggleBookmark}
                sustainabilityLens={sustainabilityLens}
                activeFilters={selectedFilters}
                unknownHours={unknownHours}
                sharedIds={sharedIds}
                onSaveShared={() => saveMany(sharedIds)}
                onCloseShared={closeSharedList}
                searchQuery={searchQuery}
                onClearFilters={() => {
                  setSelectedFilters([]);
                  setSearchQuery('');
                  // The button goes with the empty state; put focus where the
                  // next search starts.
                  document.querySelector('.search-field input')?.focus();
                }}
                missingPlace={location.state?.missingPlace ?? null}
              />
            </section>
          </>
        )}

        {/* Tab panels rendered inside the sidebar */}
        {activeTab === 'journal' && (
          <JournalPanel bookmarks={bookmarks} onRestaurantClick={openDetail} sessionEnded={sessionEnded && !session} />
        )}
        {activeTab !== 'map' && activeTab !== 'journal' && (
          <TabPanel
            tab={activeTab}
            onNavigate={selectTab}
            session={session}
            googleReady={googleReady}
            onSignIn={signIn}
            onSignOut={signOut}
            onDeleteRecords={deleteRecords}
            lastSyncFailed={lastSyncFailed}
            sessionEnded={sessionEnded}
            signInFailed={signInFailed}
            savedCount={bookmarks.length}
            visitedCount={visitedIds.length}
          />
        )}

        <TabBar 
          activeTab={activeTab} 
          onSelect={selectTab} 
          isCollapsed={isSidebarCollapsed} 
        />
      </div>

      <div className="border-region" inert={modalOpen || undefined}>
        <button 
          className="sidebar-toggle"
          aria-label={isSidebarCollapsed ? t('app.sidebarExpand') : t('app.sidebarCollapse')}
          onClick={() => setIsSidebarCollapsed(prev => !prev)}
        >
          {isSidebarCollapsed ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          )}
        </button>
      </div>

      {/* Layer 2: Full-Screen Detail Modal */}
      <RestaurantDetail
        restaurant={selectedRestaurant}
        onClose={closePlace}
        isBookmarked={selectedRestaurant ? bookmarkedIds.includes(selectedRestaurant.id) : false}
        onToggleBookmark={handleToggleBookmark}
        isVisited={selectedRestaurant ? visitedIds.includes(selectedRestaurant.id) : false}
        onToggleVisited={handleToggleVisited}
        // A distance "from map centre" only means something to someone who
        // was looking at the map; from a shared link it measured from a
        // default centre they never saw.
        mapCenter={location.state?.fromApp ? mapCenter : null}
        userLocation={userLocation}
        journey={journey}
        onJourneyStop={openJourneyStop}
        focusStory={focusStory}
        focusDirections={focusDirections}
        docked={isWide}
      />

      {isSubmit && (
        <SubmitSheet
          key={location.search}
          place={submitPlace}
          onClose={() => navigate(submitPlace ? `/place/${submitPlace.id}` : tabPath, { replace: true })}
        />
      )}
      {isPrivacy && <PrivacySheet onClose={() => navigate(tabPath, { replace: true })} />}
      {/* Opened from a place, the cards close back to that place. */}
      {isCards && (
        <StaffCardSheet
          initialCard={new URLSearchParams(location.search).get('card')}
          onClose={() => (location.state?.fromApp ? navigate(-1) : navigate(tabPath, { replace: true }))}
          onCardChange={(card) => navigate(`/cards?card=${card}`, { replace: true, state: location.state })}
        />
      )}

    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />} />
      <Route path="/place/:id" element={<AppShell />} />
      <Route path="/submit" element={<AppShell />} />
      <Route path="/privacy" element={<AppShell />} />
      <Route path="/cards" element={<AppShell />} />
      {/* Anything else (/discover, an old link) lands on the map, not on a
          blank page. */}
      <Route path="*" element={<AppShell />} />
    </Routes>
  );
}
