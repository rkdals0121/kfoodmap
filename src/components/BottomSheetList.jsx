import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PlaceImage from './PlaceImage';
import { HeartIcon, CompassIcon, MapPinIcon } from './Icons';
import { haversineKm, formatDistance, getOpenStatus, coordsOf, displayName, statusClass, DAY_KEYS, formatClock } from '../utils';
import { dietaryBadges } from '../data/verification';
import ClaimChip from './ClaimChip';
import { TRAIT_GROUPS } from '../filters';
import { CHIP_GROUPS } from '../i18n/labels';
import { matchesArea, OPEN_NOW, OPEN_AT, SAVED_ONLY, FULLY_VEGAN, SHARED_LIST } from '../filters';
import { romaniseQuery } from '../data/area-names';

const CHIP_LABEL_KEY = {
  ...Object.fromEntries(CHIP_GROUPS.flatMap(g => g.chips).map(c => [c.id, c.labelKey])),
  // The chips that are not traits (filters.js) are named by the same keys
  // the chip row uses, so the "nothing matches" summary is in one language.
  [OPEN_NOW]: 'filters.openNow',
  [OPEN_AT]: 'filters.openAt',
  [SAVED_ONLY]: 'filters.savedOnly',
  [FULLY_VEGAN]: 'filters.fullyVegan',
  [SHARED_LIST]: 'journal.shareListTitle',
};

// How many cards the list draws at a time (see BottomSheetList).
const PAGE = 40;

// The traits that make up the sustainability axis (see TRAIT_GROUPS in App).
const SUSTAINABILITY_TRAITS = TRAIT_GROUPS.Sustainability;

function PlaceCard({ place, bookmarked, onOpen, onToggleBookmark, onReadStory, onDirections, lens, stop = 0, at = null }) {
  const { t } = useTranslation();
  const name = displayName(place.name);
  // With "Open at…" on, the card answers for that time, as the list does.
  const status = getOpenStatus(place.hours, at ?? undefined);
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
  // Dietary claims carry the claim mark; traits are a plain line under them
  // (a filled chip read as more certain than the claim beside it).
  const claims = dietaryBadges(place);
  // No place has a photo yet. Until one does, a placeholder thumbnail took
  // half the card and left one card per screen; without it the card is
  // text only and three or four fit.
  const hasPhoto = Boolean(place.photo || place.coverImage);

  return (
    <article className={`place-card${hasPhoto ? '' : ' place-card--text'}`}>
      <div className="place-card__body">
        {/* Stretched link: the name button's ::after covers the whole card */}
        <h3 className="place-card__name">
          <button className="place-card__open-btn" onClick={() => onOpen(place)}>
            {/* In a journey, the same number as the stop's mark on the map. */}
            {/* Read as "Stop 1: EID…", not "1EID…". */}
            {stop > 0 && (
              <>
                <span className="place-card__stop" aria-hidden="true">{stop}</span>
                <span className="visually-hidden">{t('detail.journeyPrev', { index: stop })}: </span>
              </>
            )}
            {name}
          </button>
        </h3>

        {/* Where, then when. Distance is from the map centre (the list
            header says so). Unknown hours are said, not left blank. */}
        <p className="place-card__where">
          <span className="place-card__zone">{place.zone}</span>
          {/* Past 50 km a distance from the map centre means nothing to a
              visitor (a shared link opens over Seoul), so it is left out. */}
          {(place.fromYou || place.distanceKm <= 50) && (
            <>
              <span aria-hidden="true"> · </span>
              <span className="place-card__distance">
                {formatDistance(place.distanceKm)}
                <span className="visually-hidden"> {place.fromYou ? t('list.fromYou') : t('list.fromMapCentre')}</span>
              </span>
            </>
          )}
        </p>
        <p className="place-card__meta">
          {status ? (
            <>
              <span className={statusClass(status)}>{status.label}</span>
              {status.detail && <> · {status.detail}</>}
            </>
          ) : (
            <span className="place-card__unknown">{t('list.hoursUnknown')}</span>
          )}
        </p>

        {claims.length > 0 && (
          <div className="place-card__badges">
            {claims.map(b => <ClaimChip key={b.key} kind={b.key} label={b.label} fact={b.fact} />)}
          </div>
        )}
        {traits.length > 0 && (
          <p className="place-card__traits">{traits.map(id => t(CHIP_LABEL_KEY[id] ?? id)).join(' · ')}</p>
        )}

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
            onClick={() => onDirections(place)}
          >
            <CompassIcon size={20} />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function BottomSheetList({
  restaurants, onRestaurantClick, onReadStory, onDirections, onToggleBookmark, bookmarkedIds, mapCenter,
  sustainabilityLens, activeFilters = [], searchQuery = '', onClearFilters, missingPlace = null, unknownHours = 0,
  userLocation = null, sharedIds = [], sharedJourney = null, onSaveShared, onCloseShared, planAt = null, planDate = null,
}) {
  const { t } = useTranslation();
  const centredOnYou = Boolean(userLocation)
    && haversineKm(mapCenter[0], mapCenter[1], userLocation.lat, userLocation.lng) < 0.3;
  // Nearest first — but while searching, places whose area or address
  // matches a search word come before places that only match by name, so
  // "Busan korean" lists Busan before Seoul's "Busan Jib".
  // A journey's stops keep the journey's own order: it is a route, and
  // "nearest the map centre" shuffled it.
  const journeyOrder = Boolean(sharedJourney) && activeFilters.includes(SHARED_LIST);
  const sorted = useMemo(() => {
    const inArea = (r) => matchesArea(r, searchQuery);
    const stop = (r) => sharedIds.indexOf(r.id);
    return restaurants
      .map(r => {
        const { lat, lng } = coordsOf(r);
        // The list follows the map (sortKm: nearest the map centre), so it
        // still works when someone in Seoul looks at Busan. The distance
        // printed is from the visitor once "My location" has answered, as
        // on Naver and Kakao; until then it is from the map centre.
        const sortKm = haversineKm(mapCenter[0], mapCenter[1], lat, lng);
        const distanceKm = userLocation ? haversineKm(userLocation.lat, userLocation.lng, lat, lng) : sortKm;
        return { ...r, sortKm, distanceKm, fromYou: Boolean(userLocation), areaMatch: inArea(r) };
      })
      .sort((a, b) => (journeyOrder
        ? stop(a) - stop(b)
        : (b.areaMatch - a.areaMatch) || (a.sortKm - b.sortKm)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, mapCenter, searchQuery, userLocation, journeyOrder, sharedIds.join(',')]);

  // Draw the nearest PAGE cards and add more as the end of the list scrolls
  // into view. With 385 places, re-rendering every card on each map move
  // (the list re-sorts by the map's centre) was the main cost of panning.
  // A new search or filter starts from the top again; a map move keeps what
  // has been opened so far.
  const [shown, setShown] = useState(PAGE);
  // Keyed on which places are listed, not on the array: saving a place or
  // the "Open now" minute tick rebuilds the array with the same places, and
  // resetting then threw the reader back to the first page.
  const listKey = restaurants.map(r => r.id).join(',');
  useEffect(() => { setShown(PAGE); }, [listKey]);
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
        {/* Announced politely when a filter or search changes the count. */}
        <h2><span aria-live="polite">{t('list.placeCount', { count: sorted.length })}</span></h2>
        {sorted.length > 1 && (
          <span className="place-list__hint">
            {/* While the map is still centred on the visitor, the order and
                the distances are the same thing: say just that. Once the
                map is moved they part, and the label says both. */}
            {journeyOrder
              ? t('list.journeyOrder')
              : sorted[0].areaMatch
                ? t('list.areaFirst')
                : centredOnYou ? t('list.nearestYou') : t('list.nearestFirst')}
            {userLocation && !centredOnYou && <> · {t('list.distanceFromYou')}</>}
          </span>
        )}
      </div>

      {/* "Pusan" or "釜山" was also searched as "Busan": say so, so the
          results are not a mystery and the spelling on signs is learned. */}
      {searchQuery.trim() && romaniseQuery(searchQuery) && (
        <p className="place-list__searched-as">{t('list.searchedAs', { query: romaniseQuery(searchQuery) })}</p>
      )}

      {/* Said once for the whole list rather than on every card: the same
          caveat the detail page carries, so the lines below are never read as
          audited. */}
      {missingPlace && !searchQuery.trim() && activeFilters.length === 0 && (
        <p className="section-note place-list__note" role="status">{t('list.missingPlace')}</p>
      )}

      {/* Said while the Halal filter is on and no place listed holds a
          sighted certificate (true of every place today). */}
      {/* A list someone shared (/?list=…): say what this is, and offer the
          two things a reader does with it — keep it, or leave it. */}
      {activeFilters.includes(SHARED_LIST) && (
        <div className="shared-list-note" role="status">
          <p>
            {sharedJourney
              ? t('list.journeyNote', { title: sharedJourney.title, count: sharedIds.length })
              : t('list.sharedNote', { count: sharedIds.length })}
          </p>
          <div className="shared-list-note__actions">
            {sharedIds.every(id => bookmarkedIds.includes(id))
              ? <span className="shared-list-note__done">{t('list.sharedSaved')}</span>
              : <button type="button" className="shared-list-note__btn shared-list-note__btn--primary" onClick={onSaveShared}>{t('list.sharedSaveAll')}</button>}
            <button type="button" className="shared-list-note__btn" onClick={onCloseShared}>{t('list.sharedClose')}</button>
          </div>
        </div>
      )}
      {/* "Open now" hides places whose hours we never recorded; say how many,
          so an empty or short list is not read as "nothing else exists". */}
      {activeFilters.includes(OPEN_NOW) && (
        <p className="section-note place-list__note" role="status">
          {unknownHours > 0 ? t('list.openNowNote', { count: unknownHours }) : t('list.openNowNoteNone')}
        </p>
      )}
      {activeFilters.includes(OPEN_AT) && planAt && (() => {
        const when = `${t(`hours.day.${DAY_KEYS[planAt.day]}`)} ${formatClock(planAt.minutes)}`;
        return (
          <p className="section-note place-list__note" role="status">
            {unknownHours > 0 ? t('list.openAtNote', { count: unknownHours, when }) : t('list.openAtNoteNone', { when })}
          </p>
        );
      })()}
      {/* Chips combine as AND; with both diets on, say so — someone after
          "halal places and vegan places" otherwise loses most of both. */}
      {activeFilters.includes('Halal') && activeFilters.includes('Vegan') && (
        <p className="section-note place-list__note">{t('list.bothDietsNote')}</p>
      )}
      {/* The Vegan chip includes "vegan options" places, as the Halal chip
          has its own caveat. */}
      {activeFilters.includes('Vegan') && !activeFilters.includes('Halal') && !activeFilters.includes(FULLY_VEGAN) && sorted.length > 0
        && sorted.some(r => r.dietary?.vegan?.value === 'options') && (
        <p className="section-note place-list__note">{t('list.veganOptionsNote')}</p>
      )}
      {/* "Fully vegan" is the record's level, not a certificate: say what
          it rests on, since most are Reported. */}
      {activeFilters.includes(FULLY_VEGAN) && sorted.length > 0 && (
        <p className="section-note place-list__note">{t('list.fullyVeganNote')}</p>
      )}
      {activeFilters.includes('Halal') && sorted.length > 0
        && !sorted.some(r => r.dietary?.halal?.value === 'certified') && (
        <p className="section-note place-list__note">{t('list.halalCaveat')}</p>
      )}

      {sustainabilityLens && sorted.length > 0 && (
        <p className="section-note place-list__note">
          {t('list.esgCaveat')}
        </p>
      )}

      {sorted.slice(0, shown).map(r => (
        <PlaceCard
          key={r.id}
          place={r}
          stop={journeyOrder ? sharedIds.indexOf(r.id) + 1 : 0}
          at={planDate}
          bookmarked={bookmarkedIds.includes(r.id)}
          onOpen={onRestaurantClick}
          onReadStory={onReadStory}
          onDirections={onDirections}
          onToggleBookmark={onToggleBookmark}
          lens={sustainabilityLens}
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
          {/* "Saved" with nothing saved is not a failed search. */}
          <p><strong>{t(activeFilters.includes(SAVED_ONLY) && bookmarkedIds.length === 0 ? 'list.noSavedTitle' : 'list.noMatch')}</strong></p>
          {/* Say which conditions produced nothing, so the way out is obvious. */}
          {(activeFilters.length > 0 || searchQuery.trim()) && (
            <p className="place-list__criteria">
              {[
                ...activeFilters.map(id => t(CHIP_LABEL_KEY[id] ?? id)),
                ...(searchQuery.trim() ? [`“${searchQuery.trim()}”`] : []),
              ].join(' + ')}
            </p>
          )}
          {/* The way out comes before the hint, so it is visible in the
              half-height sheet above the tab bar. */}
          {onClearFilters && (activeFilters.length > 0 || searchQuery.trim()) && (
            <button type="button" className="place-list__clear" onClick={onClearFilters}>
              {t('list.clearAll')}
            </button>
          )}
          <p className="place-list__hint-text">
            {t(activeFilters.includes(SAVED_ONLY) && bookmarkedIds.length === 0
              ? 'list.noSavedYet'
              : activeFilters.length ? 'list.noMatchHint' : 'list.noMatchHintSearch')}
          </p>
        </div>
      )}
    </div>
  );
}
