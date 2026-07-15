import React from 'react';
import { restaurants } from '../data/restaurants';

// Saved places rendered as passport-style stamps
export default function JournalPanel({ bookmarkedIds, onRestaurantClick }) {
  const saved = restaurants.filter(r => bookmarkedIds.includes(r.id));

  if (saved.length === 0) {
    return (
      <section className="tab-panel">
        <h2>Journal</h2>
        <div className="panel-rule" />
        <p>Bookmark places you love on the map — they will be stamped here like a gourmet passport.</p>
      </section>
    );
  }

  return (
    <section className="journal-panel">
      <h2>Journal</h2>
      <div className="panel-rule" style={{ margin: '0 auto' }} />
      <p className="journal-count">
        {saved.length} {saved.length === 1 ? 'stamp' : 'stamps'} in your gourmet passport
      </p>

      <div className="journal-grid">
        {saved.map(r => (
          <button key={r.id} className="stamp" onClick={() => onRestaurantClick(r)}>
            <span className="stamp-ring">
              <img src={r.image} alt="" />
            </span>
            <span className="stamp-name">{r.name.split('(')[0].trim()}</span>
            <span className="stamp-zone">{r.zone}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
