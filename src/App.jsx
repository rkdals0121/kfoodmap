import React, { useState, useMemo, useEffect } from 'react';
import { Routes, Route, useParams, useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { restaurants } from './data/restaurants';
import MapComponent from './components/MapComponent';
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
import { useOnlineStatus } from './hooks/useOnlineStatus';
import useAppUpdate from './hooks/useAppUpdate';
import { MAP_CENTER } from './utils';
import { matchesDietary, isQuarantined } from './data/verification';
import { resolvePlace } from './data/leads';
import { loadLocalPassport, saveLocalPassport, savedOnly } from './data/passport';
import usePassportSync from './hooks/usePassportSync';
import { DIETARY_CHIPS, TRAIT_GROUPS, matchesSearch } from './filters';
import './index.css';

// Selecting anything on the sustainability axis — the group chip or either
// member — turns the list into a lens: each card states, in the restaurant's
// own recorded words, why it is here. Nothing new is written for this; the
// line is the esg_point already shown on the detail page.
const SUSTAINABILITY_AXIS = ['Sustainability', ...TRAIT_GROUPS.Sustainability];

// Quarantined records (existence itself unconfirmed) are excluded from every
// discovery surface — map, search, cards, Journal — at this single point.
const activeRestaurants = restaurants.filter(r => !isQuarantined(r));

function AppShell() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const { updateReady, reload } = useAppUpdate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState([]);
  // The URL is the source of truth for which restaurant is open — no
  // separate state to keep in sync. activeRestaurants already excludes
  // quarantined places, so an id that's quarantined or simply doesn't
  // exist both resolve to null here, and the effect below sends it home.
  const selectedRestaurant = useMemo(
    () => (id ? activeRestaurants.find(r => r.id === id) ?? null : null),
    [id],
  );
  const focusStory = Boolean(location.state?.focusStory);
  const isSubmit = location.pathname === '/submit';
  const isPrivacy = location.pathname === '/privacy';
  const submitPlace = useMemo(
    () => (isSubmit ? resolvePlace(new URLSearchParams(location.search).get('place'), activeRestaurants) : null),
    [isSubmit, location.search],
  );

  useEffect(() => {
    if (id && !selectedRestaurant) navigate('/', { replace: true });
  }, [id, selectedRestaurant, navigate]);
  // State is the whole passport, tombstones included — a tombstone is the
  // only record that an unsave happened, and dropping it here would let the
  // next sync resurrect the place. Children still receive only saved entries.
  const [entries, setEntries] = useState(loadLocalPassport);
  const [activeTab, setActiveTab] = useState('map');
  const [mapCenter, setMapCenter] = useState(MAP_CENTER);
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
  const openDetail = (r) => { if (isQuarantined(r)) return; if (r.id !== id) navigate(`/place/${r.id}`); };
  const openStory = (r) => { if (isQuarantined(r)) return; navigate(`/place/${r.id}`, { state: { focusStory: true } }); };

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
    if (id) navigate('/', { replace: true });
  };

  const handleToggleBookmark = (placeId) => {
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
  const handleToggleVisited = (placeId) => {
    const now = Date.now();
    setEntries(prev => prev.map(e =>
      e.id === placeId && e.savedAt !== null
        ? { ...e, visitedAt: e.visitedAt === null ? now : null, updatedAt: now }
        : e,
    ));
  };

  const filteredRestaurants = useMemo(() => {
    return activeRestaurants.filter(r => {
      // 1. Filter chips (AND across chips). A dietary chip only matches on
      // evidence — an unknown dietary record never matches, so we never send
      // someone somewhere we can't vouch for. A group chip ORs within itself.
      const matchesChips = selectedFilters.length === 0 || selectedFilters.every(f => {
        if (DIETARY_CHIPS.includes(f)) return matchesDietary(r, f);
        const group = TRAIT_GROUPS[f];
        return group ? r.traits.some(t => group.includes(t)) : r.traits.includes(f);
      });

      // 2. Free-text search: name, vibe, area and street address.
      return matchesChips && matchesSearch(r, searchQuery);
    });
  }, [selectedFilters, searchQuery]);

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
    <div className={`app-shell ${isSidebarCollapsed ? 'is-collapsed' : ''}`}>
      {/* Map is now at the base level */}
      <div className="map-region">
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
        <MapComponent
          restaurants={filteredRestaurants}
          onMarkerClick={openDetail}
          selectedId={selectedRestaurant?.id}
          onCenterChange={setMapCenter}
        />
      </div>

      <div className={`sidebar-region ${activeTab === 'map' ? `sheet-state-${sheetState}` : 'non-map-tab'}`}>
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
              <div className="sheet-handle-area" onClick={() => setSheetState(s => (s + 1) % 3)}>
                <div className="sheet-handle-bar" />
              </div>

              {/* Search + dietary filters */}
              <FilterBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedFilters={selectedFilters}
                onToggleFilter={handleToggleFilter}
              />
            </div>

            {/* Restaurant list */}
            <section className="list-region" aria-label={t('app.restaurantList')}>
              <BottomSheetList
                restaurants={filteredRestaurants}
                mapCenter={mapCenter}
                bookmarkedIds={bookmarkedIds}
                onRestaurantClick={openDetail}
                onReadStory={openStory}
                onToggleBookmark={handleToggleBookmark}
                sustainabilityLens={sustainabilityLens}
                activeFilters={selectedFilters}
                searchQuery={searchQuery}
                onClearFilters={() => { setSelectedFilters([]); setSearchQuery(''); }}
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
            onNavigate={setActiveTab}
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
          onSelect={setActiveTab} 
          isCollapsed={isSidebarCollapsed} 
        />
      </div>

      <div className="border-region">
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
        onClose={() => navigate('/')}
        isBookmarked={selectedRestaurant ? bookmarkedIds.includes(selectedRestaurant.id) : false}
        onToggleBookmark={handleToggleBookmark}
        isVisited={selectedRestaurant ? visitedIds.includes(selectedRestaurant.id) : false}
        onToggleVisited={handleToggleVisited}
        mapCenter={mapCenter}
        focusStory={focusStory}
      />

      {isSubmit && (
        <SubmitSheet
          key={location.search}
          place={submitPlace}
          onClose={() => navigate(submitPlace ? `/place/${submitPlace.id}` : '/', { replace: true })}
        />
      )}
      {isPrivacy && <PrivacySheet onClose={() => navigate('/', { replace: true })} />}

    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />} />
      <Route path="/place/:id" element={<AppShell />} />
      <Route path="/submit" element={<AppShell />} />
      <Route path="/privacy" element={<AppShell />} />
    </Routes>
  );
}
