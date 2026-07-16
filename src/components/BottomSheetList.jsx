import React, { useMemo } from 'react';
import PlaceImage from './PlaceImage';
import { HeartIcon, CompassIcon, MapPinIcon } from './Icons';
import { haversineKm, formatDistance, getOpenStatus, directionsUrl } from '../utils';

function PlaceCard({ place, bookmarked, onOpen, onToggleBookmark, onReadStory }) {
  const name = place.name.split('(')[0].trim();
  const status = getOpenStatus(place.hours);
  const extraTags = place.tags.length - 3;

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
          {place.tags.slice(0, 3).map(tag => (
            <span key={tag} className="tag-chip">{tag}</span>
          ))}
          {extraTags > 0 && <span className="tag-chip">+{extraTags}</span>}
        </div>
      </div>

      <PlaceImage place={place} variant="thumb" className="place-card__media" />

      <div className="place-card__foot">
        <span className="place-card__rating">
          <span className="place-card__star" aria-hidden="true">★</span> {place.rating}
          <span className="place-card__reviews"> ({place.reviews})</span>
        </span>

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
            onClick={() => window.open(directionsUrl(place), '_blank')}
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
}) {
  const sorted = useMemo(() =>
    restaurants
      .map(r => ({ ...r, distanceKm: haversineKm(mapCenter[0], mapCenter[1], r.lat, r.lng) }))
      .sort((a, b) => a.distanceKm - b.distanceKm),
  [restaurants, mapCenter]);

  return (
    <div className="place-list">
      <div className="place-list__header">
        <h3>{sorted.length} {sorted.length === 1 ? 'place' : 'places'}</h3>
        {sorted.length > 1 && <span className="place-list__hint">Nearest first</span>}
      </div>

      {sorted.map(r => (
        <PlaceCard
          key={r.id}
          place={r}
          bookmarked={bookmarkedIds.includes(r.id)}
          onOpen={onRestaurantClick}
          onReadStory={onReadStory}
          onToggleBookmark={onToggleBookmark}
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
