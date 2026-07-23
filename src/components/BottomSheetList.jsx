import React, { useMemo } from 'react';
import PlaceImage from './PlaceImage';
import { HeartIcon, CompassIcon, MapPinIcon } from './Icons';
import { haversineKm, formatDistance, getOpenStatus, directionsUrl, coordsOf } from '../utils';
import { dietaryBadges } from '../data/verification';

// The traits that make up the sustainability axis (see TRAIT_GROUPS in App).
const SUSTAINABILITY_TRAITS = ['Zero-waste', 'Local Sourcing'];

function PlaceCard({ place, bookmarked, onOpen, onToggleBookmark, onReadStory, lens, mapCenter }) {
  const name = place.name.split('(')[0].trim();
  const status = getOpenStatus(place.hours);
  // Dietary badges say exactly what we know ("Vegan options" ≠ "Fully vegan");
  // traits are descriptive. Cards stay scannable, so cap the list.
  //
  // Under the lens the matched trait moves to the front of the traits, because
  // the 3-badge cap otherwise hides it on exactly the places it matters most —
  // balwoo and sanchon both carry it last. Display order only; place.traits is
  // never mutated, and dietary badges keep the lead since they are the
  // safety-relevant ones.
  const traits = lens
    ? [...place.traits].sort((a, b) =>
        Number(SUSTAINABILITY_TRAITS.includes(b)) - Number(SUSTAINABILITY_TRAITS.includes(a)))
    : place.traits;
  const badges = [...dietaryBadges(place).map(b => b.label), ...traits];
  const extraBadges = badges.length - 3;

  return (
    <article className="place-card">
      <div className="place-card__body">
        {/* Stretched link: the name button's ::after covers the whole card */}
        <h4 className="place-card__name">
          <button className="place-card__open-btn" onClick={() => onOpen(place)}>
            {name}
          </button>
        </h4>

        <p className="place-card__meta">
          {status && (
            <>
              <span className={status.open ? 'is-open' : 'is-closed'}>{status.label}</span>
              <span aria-hidden="true">·</span>
              <span>{status.detail}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span>{formatDistance(place.distanceKm)}</span>
        </p>

        <div className="place-card__badges">
          {badges.slice(0, 3).map(label => (
            <span key={label} className="tag-chip">{label}</span>
          ))}
          {extraBadges > 0 && <span className="tag-chip">+{extraBadges}</span>}
        </div>

        {/* The restaurant's own recorded line, verbatim — the same string the
            detail page shows. Nothing is written or summarised for the list. */}
        {lens && <p className="place-card__esg">{place.esg_point}</p>}
      </div>

      <PlaceImage place={place} variant="thumb" className="place-card__media" />

      <div className="place-card__foot">
        <button
          className="place-card__story-btn"
          aria-label={`Read the story of ${name}`}
          onClick={() => onReadStory(place)}
        >
          Read Story
        </button>

        <div className="place-card__actions">
          <button
            className={`icon-btn${bookmarked ? ' icon-btn--saved' : ''}`}
            aria-label={bookmarked ? `Remove ${name} from journal` : `Save ${name} to journal`}
            aria-pressed={bookmarked}
            onClick={() => onToggleBookmark(place.id)}
          >
            <HeartIcon size={20} filled={bookmarked} />
          </button>
          <button
            className="icon-btn"
            aria-label={`Get directions to ${name}`}
            onClick={() => window.open(directionsUrl(place, mapCenter), '_blank')}
          >
            <CompassIcon size={20} />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function BottomSheetList({
  restaurants, onRestaurantClick, onReadStory, onToggleBookmark, bookmarkedIds, mapCenter,
  sustainabilityLens,
}) {
  const sorted = useMemo(() =>
    restaurants
      .map(r => {
        const { lat, lng } = coordsOf(r);
        return { ...r, distanceKm: haversineKm(mapCenter[0], mapCenter[1], lat, lng) };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm),
  [restaurants, mapCenter]);

  return (
    <div className="place-list">
      <div className="place-list__header">
        <h3>{sorted.length} {sorted.length === 1 ? 'place' : 'places'}</h3>
        {sorted.length > 1 && <span className="place-list__hint">Nearest first</span>}
      </div>

      {/* Said once for the whole list rather than on every card: the same
          caveat the detail page carries, so the lines below are never read as
          audited. */}
      {sustainabilityLens && sorted.length > 0 && (
        <p className="section-note place-list__note">
          Described by the restaurant and our research; not independently audited.
        </p>
      )}

      {sorted.map(r => (
        <PlaceCard
          key={r.id}
          place={r}
          bookmarked={bookmarkedIds.includes(r.id)}
          onOpen={onRestaurantClick}
          onReadStory={onReadStory}
          onToggleBookmark={onToggleBookmark}
          lens={sustainabilityLens}
          mapCenter={mapCenter}
        />
      ))}

      {sorted.length === 0 && (
        <div className="place-list__empty">
          <MapPinIcon size={26} />
          <p><strong>No places match</strong></p>
          <p>Try removing a filter or searching a different name or area.</p>
        </div>
      )}
    </div>
  );
}
