import React from 'react';

const filters = ['Vegan', 'Halal', 'Mild Taste', 'Fermented', 'Zero-waste', 'Local Sourcing'];

export default function FilterBar({ selectedFilters, onToggleFilter, searchQuery, onSearchChange }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      zIndex: 10,
      padding: '24px 20px 16px 20px',
      backgroundColor: 'rgba(255, 255, 255, 0.65)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(0,0,0,0.05)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div className="brand-header">
        <span className="brand-wordmark">K-Food Map</span>
        <span className="brand-tagline">Sustainable flavors · Seoul &amp; Incheon</span>
      </div>

      <input
        type="text" 
        placeholder="Search Seoul's Artisanal Flavors" 
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{
          width: '100%',
          padding: '14px 20px',
          borderRadius: '24px',
          border: '1px solid rgba(122, 145, 124, 0.4)',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          fontSize: '1rem',
          fontFamily: 'Outfit, sans-serif',
          color: 'var(--text-dark)',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.02)',
          outline: 'none'
        }}
      />
      
      <div className="no-scrollbar" style={{
        display: 'flex',
        gap: '10px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {filters.map(f => {
          const isActive = selectedFilters.includes(f);
          return (
            <button
              key={f}
              onClick={() => onToggleFilter(f)}
              style={{
                padding: '10px 18px',
                borderRadius: '24px',
                border: isActive ? '1px solid var(--sage-green)' : '1px solid rgba(122, 145, 124, 0.3)',
                backgroundColor: isActive ? 'var(--sage-green)' : 'var(--bg-cream)',
                color: isActive ? 'var(--white)' : 'var(--sage-green)',
                fontWeight: 600,
                fontSize: '0.95rem',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              {f}
            </button>
          );
        })}
        <div style={{ minWidth: '1px' }}></div>
      </div>
    </div>
  );
}
