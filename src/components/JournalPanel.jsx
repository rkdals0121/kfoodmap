import React, { useMemo } from 'react';
import { restaurants } from '../data/restaurants';
import { haversineKm, formatDistance, coordsOf } from '../utils';
import { isQuarantined } from '../data/verification';

function formatStampDate(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// A premium travel passport: progress, the next place to explore,
// and every saved place as a dated stamp.
export default function JournalPanel({ bookmarks, mapCenter, onRestaurantClick }) {
  const byId = useMemo(() => Object.fromEntries(restaurants.map(r => [r.id, r])), []);

  // passport pages read chronologically — oldest stamp first
  const stamped = useMemo(() =>
    bookmarks
      .map(b => ({ ...b, place: byId[b.id] }))
      .filter(b => b.place)
      .sort((a, b) => (a.savedAt ?? 0) - (b.savedAt ?? 0)),
  [bookmarks, byId]);

  const nextStop = useMemo(() => {
    const savedIds = new Set(bookmarks.map(b => b.id));
    const candidates = restaurants.filter(r => !savedIds.has(r.id) && !isQuarantined(r));
    if (candidates.length === 0) return null;
    return candidates
      .map(r => {
        const { lat, lng } = coordsOf(r);
        return { ...r, distanceKm: haversineKm(mapCenter[0], mapCenter[1], lat, lng) };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];
  }, [bookmarks, mapCenter]);

  const recent = stamped.length > 0 ? stamped[stamped.length - 1] : null;
  const recentDate = recent ? formatStampDate(recent.savedAt) : null;
  const total = restaurants.length;

  return (
    <section className="journal-panel" aria-label="Journal">
      <div className="passport-cover">
        <p className="passport-cover__eyebrow">Gourmet Passport</p>
        <h2 className="passport-cover__title">Taste your way through Korea</h2>
        <div className="passport-cover__progress">
          <span><strong>{stamped.length}</strong> of {total} stamped</span>
          <div
            className="progress-bar"
            role="progressbar"
            aria-label="Stamp progress"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={stamped.length}
          >
            <div className="progress-bar__fill" style={{ width: `${(stamped.length / total) * 100}%` }} />
          </div>
        </div>
      </div>

      {nextStop && (
        <button className="next-stop" onClick={() => onRestaurantClick(nextStop)}>
          <span className="next-stop__eyebrow">Next stop</span>
          <span className="next-stop__name">{nextStop.name.split('(')[0].trim()}</span>
          <span className="next-stop__meta">{nextStop.zone} · {formatDistance(nextStop.distanceKm)} from map center</span>
          <svg className="next-stop__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
      )}

      {recent && (
        <p className="journal-recent">
          <span className="journal-recent__label">Recently stamped</span>
          {recent.place.name.split('(')[0].trim()}{recentDate ? ` · ${recentDate}` : ''}
        </p>
      )}

      {stamped.length === 0 ? (
        <p className="journal-empty">
          Bookmark places you love on the map — each one becomes a stamp in your passport.
        </p>
      ) : (
        <div className="passport-page">
          <div className="journal-grid">
            {stamped.map(({ place, savedAt }) => {
              const date = formatStampDate(savedAt);
              return (
                <button key={place.id} className="stamp" onClick={() => onRestaurantClick(place)}>
                  <span className="stamp-ring">
                    <img src={place.image} alt="" />
                  </span>
                  <span className="stamp-name">{place.name.split('(')[0].trim()}</span>
                  <span className="stamp-zone">{place.zone}</span>
                  {date && <span className="stamp-date">{date}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
