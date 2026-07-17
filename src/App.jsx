import React, { useState, useMemo, useEffect } from 'react';
import { restaurants } from './data/restaurants';
import MapComponent from './components/MapComponent';
import FilterBar from './components/FilterBar';
import BottomSheetList from './components/BottomSheetList';
import RestaurantDetail from './components/RestaurantDetail';
import TabBar from './components/TabBar';
import TabPanel from './components/TabPanel';
import JournalPanel from './components/JournalPanel';
import { MAP_CENTER } from './utils';
import { matchesDietary, isQuarantined } from './data/verification';
import './index.css';

// Dietary chips are answered by the structured dietary record (never a tag
// string); the rest are descriptive traits.
const DIETARY_CHIPS = ['Vegan', 'Halal'];

// Quarantined records (existence itself unconfirmed) are excluded from every
// discovery surface — map, search, cards, Journal — at this single point.
const activeRestaurants = restaurants.filter(r => !isQuarantined(r));

const BOOKMARKS_KEY = 'kfm-bookmarks';

// Stored as [{ id, savedAt }]; older versions stored plain id strings — migrate on read
function loadBookmarks() {
  try {
    const saved = JSON.parse(localStorage.getItem(BOOKMARKS_KEY));
    if (!Array.isArray(saved)) return [];
    return saved
      .map(entry => (typeof entry === 'string' ? { id: entry, savedAt: null } : entry))
      .filter(entry => entry && typeof entry.id === 'string');
  } catch {
    return [];
  }
}

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [bookmarks, setBookmarks] = useState(loadBookmarks);
  const [activeTab, setActiveTab] = useState('map');
  const [mapCenter, setMapCenter] = useState(MAP_CENTER);
  const [focusStory, setFocusStory] = useState(false);

  // Single choke point for every path that opens detail (map pin, card,
  // Journal stamp/next-stop) — a quarantined restaurant is a no-op here
  // rather than rendering unverified detail.
  const openDetail = (r) => { if (isQuarantined(r)) return; setSelectedRestaurant(r); setFocusStory(false); };
  const openStory = (r) => { if (isQuarantined(r)) return; setSelectedRestaurant(r); setFocusStory(true); };

  useEffect(() => {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  }, [bookmarks]);

  const bookmarkedIds = useMemo(() => bookmarks.map(b => b.id), [bookmarks]);

  const handleToggleFilter = (filter) => {
    setSelectedFilters(prev => 
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
    setSelectedRestaurant(null);
  };

  const handleToggleBookmark = (id) => {
    setBookmarks(prev =>
      prev.some(b => b.id === id)
        ? prev.filter(b => b.id !== id)
        : [...prev, { id, savedAt: Date.now() }]
    );
  };

  const filteredRestaurants = useMemo(() => {
    return activeRestaurants.filter(r => {
      // 1. Filter chips (AND logic). A dietary chip only matches on evidence —
      // an unknown dietary record never matches, so we never send someone
      // somewhere we can't vouch for.
      const matchesChips = selectedFilters.length === 0 || selectedFilters.every(f => (
        DIETARY_CHIPS.includes(f) ? matchesDietary(r, f) : r.traits.includes(f)
      ));

      // 2. Search Query Filtering (Match name, vibe or area)
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = query === '' ||
                            r.name.toLowerCase().includes(query) ||
                            r.vibe.toLowerCase().includes(query) ||
                            r.zone.toLowerCase().includes(query);

      return matchesChips && matchesSearch;
    });
  }, [selectedFilters, searchQuery]);

  return (
    <div className="app-shell">

      {/* Search + dietary filters */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedFilters={selectedFilters}
        onToggleFilter={handleToggleFilter}
      />

      {/* Map: the discovery hero (~46vh) — filters narrow the pins */}
      <div className="map-region">
        <MapComponent
          restaurants={filteredRestaurants}
          onMarkerClick={openDetail}
          selectedId={selectedRestaurant?.id}
          onCenterChange={setMapCenter}
        />
      </div>

      {/* Restaurant list — always visible, nearest to the map center first */}
      <section className="list-region" aria-label="Restaurant list">
        <BottomSheetList
          restaurants={filteredRestaurants}
          mapCenter={mapCenter}
          bookmarkedIds={bookmarkedIds}
          onRestaurantClick={openDetail}
          onReadStory={openStory}
          onToggleBookmark={handleToggleBookmark}
        />
      </section>

      {/* Layer 2: Full-Screen Detail Modal */}
      <RestaurantDetail
        restaurant={selectedRestaurant}
        onClose={() => setSelectedRestaurant(null)}
        isBookmarked={selectedRestaurant ? bookmarkedIds.includes(selectedRestaurant.id) : false}
        onToggleBookmark={handleToggleBookmark}
        mapCenter={mapCenter}
        focusStory={focusStory}
      />

      {/* Non-map tabs cover the map; the tab bar stays on top */}
      {activeTab === 'journal' && (
        <JournalPanel bookmarks={bookmarks} mapCenter={mapCenter} onRestaurantClick={openDetail} />
      )}
      {activeTab !== 'map' && activeTab !== 'journal' && (
        <TabPanel tab={activeTab} onNavigate={setActiveTab} />
      )}
      <TabBar activeTab={activeTab} onSelect={setActiveTab} />

    </div>
  );
}
