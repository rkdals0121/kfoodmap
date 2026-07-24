import React, { useMemo } from 'react';
import { restaurants } from '../data/restaurants';
import { haversineKm, formatDistance, coordsOf } from '../utils';
import { isQuarantined } from '../data/verification';
import { HeartIcon, CompassIcon } from './Icons';

function formatStampDate(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const activeCount = restaurants.filter(r => !isQuarantined(r)).length;

export default function JournalPanel({ bookmarks, mapCenter, onRestaurantClick }) {
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
          <span className="journal-badge-count">1 Earned</span>
        </div>
        <div className="badges-grid">
          <div className="badge-item earned">
            <div className="badge-icon">🇰🇷</div>
            <span className="badge-name">First Taste</span>
          </div>
          <div className="badge-item locked">
            <div className="badge-icon">🔥</div>
            <span className="badge-name">Spicy Master</span>
          </div>
          <div className="badge-item locked">
            <div className="badge-icon">🌱</div>
            <span className="badge-name">Plant Based</span>
          </div>
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
