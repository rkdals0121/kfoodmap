import React from 'react';

const filters = ['Vegan', 'Halal', 'Mild Taste', 'Fermented', 'Zero-waste', 'Local Sourcing'];

export default function FilterBar({ selectedFilters, onToggleFilter, searchQuery, onSearchChange }) {
  return (
    <header className="home-header">
      <div className="search-field">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          placeholder="Search restaurants or neighborhoods"
          aria-label="Search restaurants or neighborhoods"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="chip-row no-scrollbar" role="group" aria-label="Dietary filters">
        {filters.map(f => {
          const isActive = selectedFilters.includes(f);
          return (
            <button
              key={f}
              className={`chip${isActive ? ' active' : ''}`}
              aria-pressed={isActive}
              onClick={() => onToggleFilter(f)}
            >
              {f}
            </button>
          );
        })}
      </div>
    </header>
  );
}
