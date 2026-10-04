import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PlaceImage from './PlaceImage';
import { HeartIcon, CompassIcon, MapPinIcon, ShareIcon } from './Icons';
import { haversineKm, formatDistance, getOpenStatus, coordsOf, displayName, koreanName, statusClass, DAY_KEYS, formatClock } from '../utils';
import { dietaryBadges } from '../data/verification';
import ClaimChip from './ClaimChip';
import { shareOrCopy } from '../share';
import { TRAIT_GROUPS } from '../filters';
import { CHIP_GROUPS } from '../i18n/labels';
import { matchesArea, OPEN_NOW, OPEN_AT, SAVED_ONLY, FULLY_VEGAN, SHARED_LIST, viewHash } from '../filters';
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

// Memoised: typing a letter, panning the map, "show more", a toast and the
// minute tick all re-render the list, and on a cheap phone forty cards
// redrawn for nothing was most of the wait. The place is the record itself
// (not a copy), its distance comes beside it, and `tick` is the minute, so
// "Open" still turns to "Closed" on time.
const PlaceCard = React.memo(function PlaceCard({ place, distanceKm, fromYou, bookmarked, onOpen, onToggleBookmark, onReadStory, onDirections, lens, stop = 0, at = null, atLabel = '' }) {
  const { t } = useTranslation();
  const name = displayName(place.name);
  // With "Open at…" on, the card answers for that time, as the list does.
  const status = getOpenStatus(place.hours, at ?? undefined, { nameDay: Boolean(at) });
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
          <button className="place-card__open-btn" aria-describedby={`pc-where-${place.id} pc-meta-${place.id} pc-claims-${place.id}`} onClick={() => onOpen(place)}>
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
        <p className="place-card__where" id={`pc-where-${place.id}`}>
          <span className="place-card__zone">{place.zone}</span>
          {/* Past 50 km a distance from the map centre means nothing to a
              visitor (a shared link opens over Seoul), so it is left out. */}
          {(fromYou || distanceKm <= 50) && (
            <>
              <span aria-hidden="true"> · </span>
              <span className="place-card__distance">
                {formatDistance(distanceKm)}
                <span className="visually-hidden"> {fromYou ? t('list.fromYou') : t('list.fromMapCentre')}</span>
              </span>
            </>
          )}
        </p>
        <p className="place-card__meta" id={`pc-meta-${place.id}`}>
          {status ? (
            <>
              {/* Which day the answer is for: "Open" alone read as now. */}
              {atLabel && <span className="place-card__at">{atLabel}: </span>}
              <span className={statusClass(status)}>{status.label}</span>
              {status.detail && <> · {status.detail}</>}
            </>
          ) : (
            <span className="place-card__unknown">{t('list.hoursUnknown')}</span>
          )}
        </p>

        {claims.length > 0 && (
          <div className="place-card__badges" id={`pc-claims-${place.id}`}>
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
            aria-label={t('list.saveAria', { name })}
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
});

export default function BottomSheetList({
  restaurants, onRestaurantClick, onReadStory, onDirections, onToggleBookmark, bookmarkedIds, mapCenter,
  sustainabilityLens, activeFilters = [], searchQuery = '', onClearFilters, missingPlace = null, unknownHours = 0,
  userLocation = null, sharedIds = [], sharedJourney = null, onSaveShared, onCloseShared, planAt = null, planDate = null, areaOnly = false, matchQuery = searchQuery, onClearInline, nearest = [], nearestFrom = '', showUnknown = false, onToggleUnknown, tick = 0, onSuggest, onPorkFree, withoutFilters = 0, onClearSearch,
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
  // The way to the places "Open now" left out for having no hours on record.
  // On a line of its own, under the notes: inside one, it was folded away
  // with the sentence (and hidden outright behind the halal caveat).
  const unknownToggle = unknownHours > 0 && onToggleUnknown
    && (activeFilters.includes(OPEN_NOW) || activeFilters.includes(OPEN_AT)) ? (
      <button type="button" className="place-list__note-btn" onClick={onToggleUnknown}>
        {t(showUnknown ? 'list.hideUnknown' : 'list.showUnknown', { n: unknownHours })}
      </button>
    ) : null;
  const nearestBlock = nearest.length > 0 ? (
            <div className="place-list__nearest">
              <p>{nearestFrom ? t('list.nearestTitle', { query: nearestFrom }) : t('list.nearResults')}</p>
              <ul className="saved-list">
                {nearest.map(({ place, km }) => (
                  <li key={place.id}>
                    <button type="button" className="saved-row" onClick={() => onRestaurantClick(place)}>
                      <span className="saved-row__main">
                        <span className="saved-row__name">{displayName(place.name)}</span>
                        <span className="saved-row__where">{place.zone} · {t('detail.nearbyAway', { distance: formatDistance(km) })}</span>
                        {/* Whether it is open, as every other row says. */}
                        {(() => {
                          const st = planDate ? getOpenStatus(place.hours, planDate, { nameDay: true }) : getOpenStatus(place.hours);
                          return (
                            <span className="saved-row__status">
                              {st ? <>{planDate && planAt && <span className="place-card__at">{t(`hours.day.${DAY_KEYS[planAt.day]}`)}: </span>}<span className={statusClass(st)}>{st.label}</span>{st.detail && <> · {st.detail}</>}</> : <span className="place-card__unknown">{t('list.hoursUnknown')}</span>}
                            </span>
                          );
                        })()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
  ) : null;
  const ranked = useMemo(() => {
    // "Itaewon, Seoul": the part before the comma is the area to lead
    // with — every result is in Seoul, and that told the order nothing.
    const lead = String(matchQuery ?? '').split(/[,，、]/)[0];
    const inArea = (r) => matchesArea(r, lead.trim() ? lead : matchQuery);
    // "Vegan Kitchen" typed in full: the place called that, before the
    // nearer places that merely mention the words.
    const typed = String(matchQuery ?? '').trim().toLowerCase();
    const names = (r) => [displayName(r.name), koreanName(r.name)].filter(Boolean).map(n => n.toLowerCase());
    const stop = (x) => sharedIds.indexOf(x.place.id);
    return restaurants
      .map(r => {
        const { lat, lng } = coordsOf(r);
        // The list follows the map (sortKm: nearest the map centre), so it
        // still works when someone in Seoul looks at Busan. The distance
        // printed is from the visitor once "My location" has answered, as
        // on Naver and Kakao; until then it is from the map centre.
        const sortKm = haversineKm(mapCenter[0], mapCenter[1], lat, lng);
        const distanceKm = userLocation ? haversineKm(userLocation.lat, userLocation.lng, lat, lng) : sortKm;
        return { place: r, sortKm, distanceKm, fromYou: Boolean(userLocation), areaMatch: inArea(r), nameIs: typed !== '' && names(r).includes(typed) };
      })
      .sort((a, b) => (journeyOrder
        ? stop(a) - stop(b)
        : (b.nameIs - a.nameIs) || (b.areaMatch - a.areaMatch) || (a.sortKm - b.sortKm)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, mapCenter, matchQuery, userLocation, journeyOrder, sharedIds.join(',')]);
  // The records in list order, for everything that asks about the places.
  const sorted = useMemo(() => ranked.map(x => x.place), [ranked]);

  // "Halal in Busan" as a link for whoever is travelling too. The link names
  // the search and the chips (filters.js viewHash) — never "Saved", which
  // would be the other person's saved places, nor a shared list, which has
  // its own link.
  const shareable = activeFilters.filter(f => f !== SAVED_ONLY && f !== SHARED_LIST);
  const viewLink = viewHash({ q: searchQuery, filters: shareable, planAt, area: areaOnly });
  const [viewShared, setViewShared] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  // The halal caveat is about what "halal" here does and does not promise:
  // where the screen has the room it starts open when the Halal chip goes
  // on, rather than folded to a line that ends before it says so.
  const halalOn = activeFilters.includes('Halal');
  useEffect(() => {
    if (halalOn && typeof window !== 'undefined' && window.innerHeight > 700) setNotesOpen(true);
  }, [halalOn]);
  // Someone searching for "certified", "인증" or "KMF" is asking the same
  // question: the caveat answers it whether or not the chip is on.
  const asksCertificate = /certif|sertifi|kmf|인증|認証|认证|認證/i.test(searchQuery);
  const activeN = activeFilters.filter(f => f !== SHARED_LIST).length + (searchQuery.trim() ? 1 : 0);
  const shareView = async () => {
    const url = `${window.location.origin}/${viewLink}`;
    // Said in words too: a bare address in a group chat says nothing.
    const words = [
      ...activeFilters.filter(f => f !== SHARED_LIST && f !== SAVED_ONLY).map(id => (id === OPEN_AT && planAt
        ? t('filters.openAtSet', { day: t(`hours.day.${DAY_KEYS[planAt.day]}`), time: formatClock(planAt.minutes) })
        : t(CHIP_LABEL_KEY[id] ?? id))),
      ...(searchQuery.trim() ? [searchQuery.trim()] : []),
    ].join(' · ');
    const how = await shareOrCopy({ title: 'K-Food Map', text: words || undefined, url });
    if (how === 'failed') { window.prompt(t('list.shareView'), url); return; }
    if (how === 'copied') { setViewShared(true); setTimeout(() => setViewShared(false), 2500); }
  };

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
  // Reset while rendering: an effect drew the old count first (hundreds of
  // cards, with the list opened far down) and only then the first page.
  const [shownFor, setShownFor] = useState(listKey);
  if (shownFor !== listKey) { setShownFor(listKey); setShown(PAGE); }
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
    // The notes above the cards fold to two lines on a phone and open on a
    // tap: with a diet chip on they filled the half-height sheet and the
    // first result was under the tab bar.
    <div
      className={`place-list${notesOpen ? ' notes-open' : ''}${activeFilters.includes(SHARED_LIST) && !searchQuery.trim() && activeFilters.length === 1 ? ' is-shared' : ''}`}
      onClick={(e) => { if (e.target.closest?.('.place-list__note')) setNotesOpen(o => !o); }}
    >
      <div className="place-list__header">
        {/* Announced politely when a filter or search changes the count. */}
        <h2><span aria-live="polite">{t('list.placeCount', { count: sorted.length })}</span></h2>
        {/* In the header row, as an icon: on its own line it was one more
            thing between a filter and its first result. */}
        {viewLink && sorted.length > 0 && (
          <button type="button" className="place-list__share" onClick={shareView} aria-label={viewShared ? t('journal.listCopied') : t('list.shareView')} title={t('list.shareView')}>
            {viewShared ? <span className="place-list__share-done">{t('journal.listCopied')}</span> : <ShareIcon size={16} />}
          </button>
        )}
        {/* Chips are a row three screens wide: one switched on further along
            is out of sight. Whatever is on (and any search), this says how
            many and takes them off — in place of the line about the order,
            which matters less than a way back. */}
        {activeN > 0 && onClearInline && sorted.length > 0 && (
          <button type="button" className="place-list__clear-inline" onClick={onClearInline}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            {t('filters.clearFilters', { n: activeN })}
          </button>
        )}
        {sorted.length > 1 && activeN === 0 && (
          <span className="place-list__hint">
            {/* While the map is still centred on the visitor, the order and
                the distances are the same thing: say just that. Once the
                map is moved they part, and the label says both. */}
            {journeyOrder
              ? t('list.journeyOrder')
              : ranked[0].areaMatch
                ? t('list.areaFirst')
                : centredOnYou ? t('list.nearestYou') : t('list.nearestFirst')}
            {userLocation && !centredOnYou && <> · {t('list.distanceFromYou')}</>}
          </span>
        )}
      </div>

      {/* "Pusan" or "釜山" was also searched as "Busan": say so, so the
          results are not a mystery and the spelling on signs is learned. */}
      {searchQuery.trim() && (romaniseQuery(matchQuery) || matchQuery !== searchQuery) && (
        <p className="place-list__searched-as">{t('list.searchedAs', { query: romaniseQuery(matchQuery) ?? matchQuery })}</p>
      )}

      {/* Said once for the whole list rather than on every card: the same
          caveat the detail page carries, so the lines below are never read as
          audited. */}

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
      <div className="place-list__notes">
      {/* The fold's own control: the notes were opened by tapping a
          paragraph, which no keyboard or screen reader could find. */}
      <button
        type="button"
        className="place-list__notes-toggle"
        aria-expanded={notesOpen}
        aria-label={t('list.notesToggle')}
        onClick={(e) => { e.stopPropagation(); setNotesOpen(o => !o); }}
      />
      {missingPlace && !searchQuery.trim() && activeFilters.length === 0 && (
        <p className="section-note place-list__note" role="status">{t('list.missingPlace')}</p>
      )}
      {/* With both diets on, why the list is short comes before all else. */}
      {activeFilters.includes('Halal') && activeFilters.includes('Vegan') && (
        <p className="section-note place-list__note">{t('list.bothDietsNote')}</p>
      )}
      {/* The halal caveat first: it is the one about safety, and behind
          the "Open now" note it was folded out of sight. */}
      {(halalOn || asksCertificate) && sorted.length > 0
        && !sorted.some(r => r.dietary?.halal?.value === 'certified') && (
        <p className="section-note place-list__note">{t('list.halalCaveat')}</p>
      )}
      {/* The caveat says pork-free places are left out and can be searched
          for — but searching with the Halal chip still on found nothing.
          One press does both. */}
      {activeFilters.includes('Halal') && onPorkFree && (
        <button type="button" className="place-list__note-btn place-list__porkfree" onClick={(e) => { e.stopPropagation(); onPorkFree(); }}>
          {t('list.showPorkFree')}
        </button>
      )}
      {/* "Open now" hides places whose hours we never recorded; say how many,
          so an empty or short list is not read as "nothing else exists". */}
      {activeFilters.includes(OPEN_NOW) && (
        <p className="section-note place-list__note" role="status">
          {unknownHours > 0 && showUnknown
            ? t('list.unknownShown', { n: unknownHours })
            : unknownHours > 0 ? t('list.openNowNote', { count: unknownHours }) : t('list.openNowNoteNone')}
        </p>
      )}
      {activeFilters.includes(OPEN_AT) && planAt && (() => {
        // Worded by the locale: "Sun 12:00 PM", "일요일 오후 12:00".
        const when = t('filters.dayTime', { day: t(`hours.day.${DAY_KEYS[planAt.day]}`), time: formatClock(planAt.minutes) });
        return (
          <p className="section-note place-list__note" role="status">
            {unknownHours > 0 && showUnknown
              ? t('list.unknownShown', { n: unknownHours })
              : unknownHours > 0 ? t('list.openAtNote', { count: unknownHours, when }) : t('list.openAtNoteNone', { when })}
          </p>
        );
      })()}
      {/* Chips combine as AND; with both diets on, say so — someone after
          "halal places and vegan places" otherwise loses most of both. */}
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

      {sustainabilityLens && sorted.length > 0 && (
        <p className="section-note place-list__note">
          {t('list.esgCaveat')}
        </p>
      )}
      </div>
      {unknownToggle}

      {ranked.slice(0, shown).map(({ place: r, distanceKm, fromYou }) => (
        <PlaceCard
          key={r.id}
          place={r}
          distanceKm={distanceKm}
          fromYou={fromYou}
          tick={tick}
          stop={journeyOrder ? sharedIds.indexOf(r.id) + 1 : 0}
          at={planDate}
          atLabel={planDate && planAt ? t(`hours.day.${DAY_KEYS[planAt.day]}`) : ''}
          bookmarked={bookmarkedIds.includes(r.id)}
          onOpen={onRestaurantClick}
          onReadStory={onReadStory}
          onDirections={onDirections}
          onToggleBookmark={onToggleBookmark}
          lens={sustainabilityLens}
        />
      ))}

      {/* One or two results in the area: what else is close. */}
      {sorted.length > 0 && !hasMore && nearestBlock}

      {hasMore && (
        <button type="button" ref={sentinelRef} className="place-list__more" onClick={() => setShown(s => s + PAGE)}>
          {t('list.showMore', { count: Math.min(PAGE, sorted.length - shown) })}
        </button>
      )}

      {sorted.length === 0 && (
        <div className={`place-list__empty${nearest.length > 0 ? ' place-list__empty--offers' : ''}`}>
          <MapPinIcon size={26} />
          {/* "Saved" with nothing saved is not a failed search. */}
          <p><strong>{t(activeFilters.includes(SAVED_ONLY) && bookmarkedIds.length === 0 ? 'list.noSavedTitle' : 'list.noMatch')}</strong></p>
          {/* Say which conditions produced nothing, so the way out is obvious. */}
          {(activeFilters.length > 0 || searchQuery.trim()) && (
            <p className="place-list__criteria">
              {[
                // "Open Mon 7:00 PM", not the chip's own name "Open at…".
                ...activeFilters.map(id => (id === OPEN_AT && planAt
                  ? t('filters.openAtSet', { day: t(`hours.day.${DAY_KEYS[planAt.day]}`), time: formatClock(planAt.minutes) })
                  : t(CHIP_LABEL_KEY[id] ?? id))),
                ...(searchQuery.trim() ? [`“${searchQuery.trim()}”`] : []),
              ].join(' + ')}
            </p>
          )}
          {nearestBlock}
          {/* A search under chips that found nothing: the search goes and
              the chips stay — "Clear everything" also took the Halal chip
              off, and listed every place to someone who had asked for halal. */}
          {onClearSearch && searchQuery.trim() && activeFilters.length > 0
            && !(activeFilters.includes(SAVED_ONLY) && bookmarkedIds.length === 0) && (
            <button type="button" className="place-list__clear" onClick={onClearSearch}>
              {t('list.clearSearchOnly')}
            </button>
          )}
          {withoutFilters > 0 && (
            <p className="place-list__hint-text">{t('list.withoutFilters', { query: searchQuery.trim(), n: withoutFilters })}</p>
          )}
          {/* The way out comes before the hint, so it is visible in the
              half-height sheet above the tab bar. */}
          {onClearFilters && (activeFilters.length > 0 || searchQuery.trim()) && (
            <button type="button" className="place-list__clear" onClick={onClearFilters}>
              {t('list.clearAll')}
            </button>
          )}
          {/* Nothing in the area searched, but the same filters match close
              by: "Haeundae" has no halal place on record and Busan has
              eight. Offer them, measured from the area that was typed. */}
          {onSuggest && searchQuery.trim() && activeFilters.length === 0 && nearest.length === 0 && (
            <button type="button" className="place-list__suggest" onClick={() => onSuggest(searchQuery.trim())}>
              {t('list.suggestThis')}
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
