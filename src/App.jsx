import React, { useState, useMemo, useEffect } from 'react';
import { restaurants } from './data/restaurants';
import MapComponent from './components/MapComponent';
import FilterBar from './components/FilterBar';
import BottomSheetList from './components/BottomSheetList';
import RestaurantDetail from './components/RestaurantDetail';
import TabBar from './components/TabBar';
import TabPanel from './components/TabPanel';
import JournalPanel from './components/JournalPanel';
import './index.css';

const BOOKMARKS_KEY = 'kfm-bookmarks';

function loadBookmarks() {
  try {
    const saved = JSON.parse(localStorage.getItem(BOOKMARKS_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [bookmarkedIds, setBookmarkedIds] = useState(loadBookmarks);
  const [activeTab, setActiveTab] = useState('map');

  useEffect(() => {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarkedIds));
  }, [bookmarkedIds]);

  const handleToggleFilter = (filter) => {
    setSelectedFilters(prev => 
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
    setSelectedRestaurant(null);
  };

  const handleToggleBookmark = (id) => {
    setBookmarkedIds(prev => 
      prev.includes(id) ? prev.filter(bId => bId !== id) : [...prev, id]
    );
  };

  const filteredRestaurants = useMemo(() => {
    return restaurants.filter(r => {
      // 1. Tag Filtering (AND logic)
      const matchesTags = selectedFilters.length === 0 || selectedFilters.every(f => r.tags.includes(f));

      // 2. Search Query Filtering (Match name, vibe or area)
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = query === '' ||
                            r.name.toLowerCase().includes(query) ||
                            r.vibe.toLowerCase().includes(query) ||
                            r.zone.toLowerCase().includes(query);

      return matchesTags && matchesSearch;
    });
  }, [selectedFilters, searchQuery]);

  const hasActiveFilters = selectedFilters.length > 0 || searchQuery.trim() !== '';

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#e5e3df' }}>
      
      {/* Layer 0: Map Background — all curated places stay pinned; filters narrow them down */}
      <MapComponent
        restaurants={filteredRestaurants}
        onMarkerClick={(r) => setSelectedRestaurant(r)}
        selectedId={selectedRestaurant?.id}
      />

      {/* Cream-celadon tint + hanji paper grain over the map */}
      <div className="map-tint" />
      <div className="paper-overlay" />

      {/* Layer 1: UI Overlays (Header) */}
      <FilterBar 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedFilters={selectedFilters} 
        onToggleFilter={handleToggleFilter} 
      />
      
      {/* Conditional Bottom List */}
      {hasActiveFilters && (
        <BottomSheetList 
          restaurants={filteredRestaurants}
          onRestaurantClick={(r) => setSelectedRestaurant(r)}
          bookmarkedIds={bookmarkedIds}
        />
      )}

      {/* Layer 2: Full-Screen Detail Modal */}
      <RestaurantDetail
        restaurant={selectedRestaurant}
        onClose={() => setSelectedRestaurant(null)}
        isBookmarked={selectedRestaurant ? bookmarkedIds.includes(selectedRestaurant.id) : false}
        onToggleBookmark={handleToggleBookmark}
      />

      {/* Non-map tabs cover the map; the tab bar stays on top */}
      {activeTab === 'journal' && (
        <JournalPanel bookmarkedIds={bookmarkedIds} onRestaurantClick={setSelectedRestaurant} />
      )}
      {activeTab !== 'map' && activeTab !== 'journal' && (
        <TabPanel tab={activeTab} />
      )}
      <TabBar activeTab={activeTab} onSelect={setActiveTab} />

    </div>
  );
}
