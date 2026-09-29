import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PlaceImage from './PlaceImage';
import { HeartIcon, CompassIcon, MapPinIcon } from './Icons';
import { haversineKm, formatDistance, getOpenStatus, directionsUrl, coordsOf, displayName } from '../utils';
import { dietaryBadges, trustBadge } from '../data/verification';
import { CLAIM_CLASS } from './claim';
import { TRAIT_GROUPS } from '../filters';

// How many cards the list draws at a time (see BottomSheetList).
const PAGE = 40;

// The traits that make up the sustainability axis (see TRAIT_GROUPS in App).
const SUSTAINABILITY_TRAITS = TRAIT_GROUPS.Sustainability;

function PlaceCard({ place, bookmarked, onOpen, onToggleBookmark, onReadStory, lens, mapCenter }) {
  const { t } = useTranslation();
  const name = displayName(place.name);
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
  // Dietary claims lead and carry their claim mark; traits follow plain.
  const claims = dietaryBadges(place).map(b => {
    const { label: level, tone } = trustBadge(b.fact);
    return { label: b.label, level, tone };
  });
  const badges = [...claims, ...traits.map(label => ({ label }))];
  const extraBadges = badges.length - 3;
  // No place has a photo yet. Until one does, a placeholder thumbnail took
  // half the card and left one card per screen; without it the card is
  // text only and three or four fit.
  const hasPhoto = Boolean(place.photo || place.coverImage);

  return (
    <article className={`place-card${hasPhoto ? '' : ' place-card--text'}`}>
      <div className="place-card__body">
        {/* Stretched link: the name button's ::after covers the whole card */}
        <h4 className="place-card__name">
          <button className="place-card__open-btn" onClick={() => onOpen(place)}>
            {name}
          </button>
        </h4>

        {/* Where, then when. Distance is from the map centre (the list
            header says so). Unknown hours are said, not left blank. */}
        <p className="place-card__where">
          <span className="place-card__zone">{place.zone}</span>
          <span aria-hidden="true"> · </span>
          <span className="place-card__distance">{formatDistance(place.distanceKm)}</span>
        </p>
        <p className="place-card__meta">
          {status ? (
            <>
              <span className={status.open ? 'is-open' : 'is-closed'}>{status.label}</span>
              {status.detail && <> · {status.detail}</>}
            </>
          ) : (
            <span className="place-card__unknown">{t('list.hoursUnknown')}</span>
          )}
        </p>

        <div className="place-card__badges">
          {badges.slice(0, 3).map(b => (b.tone ? (
            <span key={b.label} className={`tag-chip claim claim--${CLAIM_CLASS[b.tone]}`}>
              {b.label}<span className="claim__level">{b.level}</span>
            </span>
          ) : (
            <span key={b.label} className="tag-chip">{b.label}</span>
          )))}
          {extraBadges > 0 && <span className="tag-chip">+{extraBadges}</span>}
        </div>

        {/* The restaurant's own recorded line, verbatim — the same string the
            detail page shows. Nothing is written or summarised for the list. */}
        {lens && <p className="place-card__esg">{place.esg_point}</p>}
      </div>

      {hasPhoto && <PlaceImage place={place} variant="thumb" className="place-card__media" />}

      <div className="place-card__foot">
        <button
          className="place-card__story-btn"
          aria-label={t('list.readStoryAria', { name })}
          onClick={() => onReadStory(place)}
        >
          {t('discover.readStory')}
        </button>

        <div className="place-card__actions">
          <button
            className={`icon-btn${bookmarked ? ' icon-btn--saved' : ''}`}
            aria-label={bookmarked ? t('list.removeAria', { name }) : t('list.saveAria', { name })}
            aria-pressed={bookmarked}
            onClick={() => onToggleBookmark(place.id)}
          >
            <HeartIcon size={20} filled={bookmarked} />
          </button>
          <button
            className="icon-btn"
            aria-label={t('list.directionsAria', { name })}
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
  const { t } = useTranslation();
  const sorted = useMemo(() =>
    restaurants
      .map(r => {
        const { lat, lng } = coordsOf(r);
        return { ...r, distanceKm: haversineKm(mapCenter[0], mapCenter[1], lat, lng) };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm),
  [restaurants, mapCenter]);

  // Draw the nearest PAGE cards and add more as the end of the list scrolls
  // into view. With 385 places, re-rendering every card on each map move
  // (the list re-sorts by the map's centre) was the main cost of panning.
  // A new search or filter starts from the top again; a map move keeps what
  // has been opened so far.
  const [shown, setShown] = useState(PAGE);
  useEffect(() => { setShown(PAGE); }, [restaurants]);
  const sentinelRef = useRef(null);
  const hasMore = shown < sorted.length;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) setShown(s => s + PAGE);
    }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, shown]);

  return (
    <div className="place-list">
      <div className="place-list__header">
        <h3>{t('list.placeCount', { count: sorted.length })}</h3>
        {sorted.length > 1 && <span className="place-list__hint">{t('list.nearestFirst')}</span>}
      </div>

      {/* Said once for the whole list rather than on every card: the same
          caveat the detail page carries, so the lines below are never read as
          audited. */}
      {sustainabilityLens && sorted.length > 0 && (
        <p className="section-note place-list__note">
          {t('list.esgCaveat')}
        </p>
      )}

      {sorted.slice(0, shown).map(r => (
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

      {hasMore && (
        <button type="button" ref={sentinelRef} className="place-list__more" onClick={() => setShown(s => s + PAGE)}>
          {t('list.showMore', { count: Math.min(PAGE, sorted.length - shown) })}
        </button>
      )}

      {sorted.length === 0 && (
        <div className="place-list__empty">
          <MapPinIcon size={26} />
          <p><strong>{t('list.noMatch')}</strong></p>
          <p>{t('list.noMatchHint')}</p>
        </div>
      )}
    </div>
  );
}
