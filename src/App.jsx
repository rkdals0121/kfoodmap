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

// A group chip matches *any* trait in its set, which is the one place chips
// are not AND-ed. Sustainability exists because its two members are narrow
// enough that selecting both returns nothing — the group is the way to browse
// the axis, the members are still there to narrow within it.
const TRAIT_GROUPS = {
  Sustainability: ['Zero-waste', 'Local Sourcing'],
};

// Selecting anything on the sustainability axis — the group chip or either
// member — turns the list into a lens: each card states, in the restaurant's
// own recorded words, why it is here. Nothing new is written for this; the
// line is the esg_point already shown on the detail page.
const SUSTAINABILITY_AXIS = ['Sustainability', ...TRAIT_GROUPS.Sustainability];

// Quarantined records (existence itself unconfirmed) are excluded from every
// discovery surface — map, search, cards, Journal — at this single point.
const activeRestaurants = restaurants.filter(r => !isQuarantined(r));

const BOOKMARKS_KEY = 'kfm-bookmarks';

// Stored as [{ id, savedAt, visitedAt }]. Two earlier shapes migrate on read:
// { id, savedAt } (saved, never marked visited) and plain id strings (saved,
// no timestamp). savedAt is the wishlist; visitedAt is the visit record, and a
// visit only exists on a saved entry: visitedAt != null implies savedAt != null.
//
// Legacy string entries normalise to savedAt: 0, "saved at an unknown time",
// rather than null: that keeps "is it saved" a plain savedAt test with no
// legacy special case, and 0 is falsy so date rendering is unchanged.
function loadBookmarks() {
  try {
    const saved = JSON.parse(localStorage.getItem(BOOKMARKS_KEY));
    if (!Array.isArray(saved)) return [];
    return saved
      .map(entry => (typeof entry === 'string' ? { id: entry, savedAt: 0 } : entry))
      .filter(entry => entry && typeof entry.id === 'string')
      .map(entry => ({ ...entry, savedAt: entry.savedAt ?? 0, visitedAt: entry.visitedAt ?? null }));
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Single choke point for every path that opens detail (map pin, card,
  // Journal stamp/next-stop) — a quarantined restaurant is a no-op here
  // rather than rendering unverified detail.
  const openDetail = (r) => { if (isQuarantined(r)) return; setSelectedRestaurant(r); setFocusStory(false); };
  const openStory = (r) => { if (isQuarantined(r)) return; setSelectedRestaurant(r); setFocusStory(true); };

  useEffect(() => {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  }, [bookmarks]);

  const bookmarkedIds = useMemo(() => bookmarks.map(b => b.id), [bookmarks]);
  const visitedIds = useMemo(
    () => bookmarks.filter(b => b.visitedAt !== null).map(b => b.id),
    [bookmarks],
  );
  const sustainabilityLens = useMemo(
    () => selectedFilters.some(f => SUSTAINABILITY_AXIS.includes(f)),
    [selectedFilters],
  );

  const handleToggleFilter = (filter) => {
    setSelectedFilters(prev => 
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
    setSelectedRestaurant(null);
  };

  const handleToggleBookmark = (id) => {
    setBookmarks(prev =>
      prev.some(b => b.id === id)
        ? prev.filter(b => b.id !== id)   // drops visitedAt with the entry
        : [...prev, { id, savedAt: Date.now(), visitedAt: null }]
    );
  };

  // Marking a visit only ever edits an entry that is already saved, so the
  // invariant (visitedAt implies savedAt) holds by construction — this can
  // never create a record. Unsaving drops the entry, taking the visit with it.
  const handleToggleVisited = (id) => {
    setBookmarks(prev => prev.map(b =>
      b.id === id && b.savedAt !== null
        ? { ...b, visitedAt: b.visitedAt === null ? Date.now() : null }
        : b
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
    <div className={`app-shell ${isSidebarCollapsed ? 'is-collapsed' : ''}`}>

      <div className="sidebar-region">
        {/* Search + dietary filters */}
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedFilters={selectedFilters}
          onToggleFilter={handleToggleFilter}
        />

        {/* Restaurant list — always visible, nearest to the map center first */}
        <section className="list-region" aria-label="Restaurant list">
          <BottomSheetList
            restaurants={filteredRestaurants}
            mapCenter={mapCenter}
            bookmarkedIds={bookmarkedIds}
            onRestaurantClick={openDetail}
            onReadStory={openStory}
            onToggleBookmark={handleToggleBookmark}
            sustainabilityLens={sustainabilityLens}
          />
        </section>

        {/* Non-map tabs cover the map; the tab bar stays on top */}
        {activeTab === 'journal' && (
          <JournalPanel bookmarks={bookmarks} mapCenter={mapCenter} onRestaurantClick={openDetail} />
        )}
        {activeTab !== 'map' && activeTab !== 'journal' && (
          <TabPanel tab={activeTab} onNavigate={setActiveTab} />
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
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setIsSidebarCollapsed(prev => !prev)}
        >
          {isSidebarCollapsed ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          )}
        </button>
      </div>

      {/* Map: the discovery hero (~46vh) — filters narrow the pins */}
      <div className="map-region">
        <MapComponent
          restaurants={filteredRestaurants}
          onMarkerClick={openDetail}
          selectedId={selectedRestaurant?.id}
          onCenterChange={setMapCenter}
        />
      </div>

      {/* Layer 2: Full-Screen Detail Modal */}
      <RestaurantDetail
        restaurant={selectedRestaurant}
        onClose={() => setSelectedRestaurant(null)}
        isBookmarked={selectedRestaurant ? bookmarkedIds.includes(selectedRestaurant.id) : false}
        onToggleBookmark={handleToggleBookmark}
        isVisited={selectedRestaurant ? visitedIds.includes(selectedRestaurant.id) : false}
        onToggleVisited={handleToggleVisited}
        mapCenter={mapCenter}
        focusStory={focusStory}
      />

    </div>
  );
}
