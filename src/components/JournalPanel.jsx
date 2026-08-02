import React, { useMemo } from 'react';
import { restaurants } from '../data/restaurants';
import { isQuarantined, isKnown, VEGAN } from '../data/verification';

function formatStampDate(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function JournalPanel({ bookmarks, onRestaurantClick }) {
  const byId = useMemo(() => Object.fromEntries(restaurants.map(r => [r.id, r])), []);

  const stamped = useMemo(() =>
    bookmarks
      .map(b => ({ ...b, place: byId[b.id] }))
      .filter(b => b.place && !isQuarantined(b.place))
      .sort((a, b) => (a.savedAt ?? 0) - (b.savedAt ?? 0)),
  [bookmarks, byId]);

  const visitedList = stamped.filter(s => s.visitedAt != null);
  const savedList = stamped.filter(s => s.visitedAt == null);

  const neighborhoods = useMemo(() => {
    const zones = new Set(visitedList.map(s => s.place.zone));
    return Array.from(zones);
  }, [visitedList]);

  const badges = [
    { key: 'first-taste', icon: '🇰🇷', name: 'First Taste', earned: visitedList.length > 0 },
    {
      key: 'plant-based',
      icon: '🌱',
      name: 'Plant Based',
      earned: visitedList.some(({ place }) => isKnown(place.dietary?.vegan) && place.dietary.vegan.value === VEGAN.FULL),
    },
  ];
  const earnedCount = badges.filter(b => b.earned).length;

  return (
    <section className="journal-panel" aria-label="Journal">
      <div className="passport-cover">
        <h2 className="passport-cover__title">Your Food Passport</h2>
        <div className="passport-stats">
          <div className="stat-box">
            <span className="stat-num">{visitedList.length}</span>
            <span className="stat-label">Visited</span>
          </div>
          <div className="stat-box">
            <span className="stat-num">{savedList.length}</span>
            <span className="stat-label">Saved</span>
          </div>
          <div className="stat-box">
            <span className="stat-num">{neighborhoods.length}</span>
            <span className="stat-label">Areas</span>
          </div>
        </div>
      </div>

      <div className="journal-section">
        <div className="journal-section-header">
          <h3>Badges</h3>
          <span className="journal-badge-count">{earnedCount} Earned</span>
        </div>
        <div className="badges-grid">
          {badges.map(badge => (
            <div key={badge.key} className={`badge-item ${badge.earned ? 'earned' : 'locked'}`}>
              <div className="badge-icon">{badge.icon}</div>
              <span className="badge-name">{badge.name}</span>
            </div>
          ))}
        </div>
      </div>

      {visitedList.length > 0 && (
        <div className="journal-section">
          <div className="journal-section-header">
            <h3>Visited Places</h3>
          </div>
          <div className="journal-grid">
            {visitedList.map(({ place, visitedAt }) => (
              <button
                key={place.id}
                className="stamp"
                onClick={() => onRestaurantClick(place)}
              >
                <span className="stamp-ring">
                  <img src={place.image} alt="" />
                </span>
                <span className="stamp-name">{place.name.split('(')[0].trim()}</span>
                <span className="stamp-zone">{place.zone}</span>
                {visitedAt && <span className="stamp-date">{formatStampDate(visitedAt)}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {savedList.length > 0 && (
        <div className="journal-section">
          <div className="journal-section-header">
            <h3>Saved for Later</h3>
          </div>
          <div className="journal-grid">
            {savedList.map(({ place, savedAt }) => (
              <button
                key={place.id}
                className="stamp stamp--saved"
                onClick={() => onRestaurantClick(place)}
              >
                <span className="stamp-ring">
                  <img src={place.image} alt="" />
                </span>
                <span className="stamp-name">{place.name.split('(')[0].trim()}</span>
                <span className="stamp-zone">{place.zone}</span>
                {savedAt && <span className="stamp-date">{formatStampDate(savedAt)}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {stamped.length === 0 && (
        <div className="journal-empty">
          <div className="journal-empty__icon" aria-hidden="true">📕</div>
          <p className="journal-empty__title">Your passport is empty</p>
          <p className="journal-empty__body">
            Save places to your passport and track your Korean food journey.
          </p>
        </div>
      )}
    </section>
  );
}
