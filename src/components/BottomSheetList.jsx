import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStories, useStoriesWaiting } from '../hooks/useStories';
import { placeArea } from '../place-area';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import PlaceImage from './PlaceImage';
import { HeartIcon, CompassIcon, MapPinIcon, ShareIcon } from './Icons';
import { haversineKm, formatDistance, getOpenStatus, coordsOf, displayName, koreanName, statusClass, DAY_KEYS, formatClock, koreaToday } from '../utils';
import { dietaryBadges } from '../data/verification';
import ClaimChip from './ClaimChip';
import { shareOrCopy } from '../share';
import { TRAIT_GROUPS, asksOpenNow, withoutOpenNow, plannedTime, liftDietWords } from '../filters';
import { CHIP_GROUPS } from '../i18n/labels';
import { matchesArea, OPEN_NOW, OPEN_AT, SAVED_ONLY, FULLY_VEGAN, SHARED_LIST, viewHash } from '../filters';
import { romaniseQuery, AREA_NAMES, onlyFillers } from '../data/area-names';
import { colon, quoted } from '../i18n/punct';

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
// The area a suggestion is measured from, by its Korean name for a reader of
// Korean who typed it in Korean ("Gyeongju" → "경주"); as given when the
// list of areas has no Korean for it.
// For other readers, as the map spells it: "gyeongju" was typed, "Gyeongju"
// is the name.
const listedArea = (name) => Object.keys(AREA_NAMES).find(k => k.toLowerCase() === String(name).toLowerCase());
const koreanArea = (name) => {
  const key = listedArea(name);
  return (key && [].concat(AREA_NAMES[key] ?? []).find(a => typeof a === 'string' && /[가-힣]/.test(a))) || name;
};
const PAGE = 40;
// Where the list was left, kept while another tab is on screen (the list is
// not drawn then): eighty cards down, a look at the Journal and back used to
// land on the first card again. Discover and the Journal remember the same.
const listMemory = { key: null, shown: PAGE, scrollTop: 0 };

// The traits that make up the sustainability axis (see TRAIT_GROUPS in App).
const SUSTAINABILITY_TRAITS = TRAIT_GROUPS.Sustainability;

// Memoised: typing a letter, panning the map, "show more", a toast and the
// minute tick all re-render the list, and on a cheap phone forty cards
// redrawn for nothing was most of the wait. The place is the record itself
// (not a copy), its distance comes beside it, and `tick` is the minute, so
// "Open" still turns to "Closed" on time.
// (ナッツ: not ドーナッツ or ココナッツ, which are taken out first. No lookbehind — older iOS cannot parse one.)
// …and what is asked for by leaving something out: "no fish sauce" finds twelve
// places, among them one whose note says its kimchi contains it; "not spicy"
// finds thirteen that are. The words are found in the notes one by one.
const INGREDIENT_WORDS = /^(?:no|not|non|without|tanpa)\s|\bfree\b|allerg|alergi|peanut|kacang|gluten|c(?:o)?eliac|lactose|dairy|\bnuts?\b|\beggs?\b|honey|fish sauce|anchov|oyster sauce|shrimp paste|alcohol|\bmsg\b|garlic|\bonions?\b|액젓|젓갈|달걀|계란|없는|없이|빼고|魚醤|はちみつ|なし|抜き|不使用|卵|乳製品|鱼露|魚露|鸡蛋|雞蛋|蜂蜜|不含|无糖|无麸质|无蛋|无奶|无酒精|無糖|無麩質|無蛋|無奶|無酒精|sesame|shellfish|五辛|오신채|알레르기|알러지|땅콩|견과|글루텐|참깨|갑각류|アレルギー|ピーナッツ|ナッツ|グルテン|ごま|甲殻類|过敏|過敏|花生|坚果|堅果|麸质|麩質|芝麻/i;
// (Not "no pork" / "pork-free" by itself: that is a level the records do
// carry. Beside another such word — "no pork gluten free" — the note stands.)
const PORK_FREE_TYPED = /\b(?:no|without)\s+pork\b|\bpork[- ]?free\b|(?:tanpa|bebas)\s+babi|돼지고기\s*없(?:는|음)(?:\s*곳)?|포크\s*프리|豚肉不使用|豚肉なし|ポークフリー|不含猪肉|无猪肉|不含豬肉/gi;
// "No meat", "meat-free", "고기 없는": the vegan question, answered from the
// record like "no pork" — not an ingredient the map cannot check.
// "Halal near me", "근처 맛집", "附近的清真餐厅": near the reader — which the map
// knows only once "My location" is pressed. Not "near Myeongdong": that
// names where.
const NEAR_ME_TYPED = /\bnear\s*me\b|\bnear(?:by|est)\b|\b(?:around|close\s+to)\s+me\b|\bclosest\b|근처|주변|가까운|近く|周辺|最寄り|附近|离我|離我|\bdekat\s+(?:sini|saya)\b|\bterdekat\b|\bsekitar\s+sini\b/i;
// …nor "해방촌 근처", "광장시장 근처": whatever is left beside the diet and the
// words that name nothing is a place.
const asksNearMe = (query, plan = null) => {
  const said = String(query ?? '');
  if (!NEAR_ME_TYPED.test(said)) return false;
  const base = plan?.sure || plan?.now ? plan.rest : withoutOpenNow(said);
  // (Read as the search reads it: "附近的清真餐厅" is written without spaces.)
  const rest = liftDietWords((romaniseQuery(base) ?? base).replace(new RegExp(NEAR_ME_TYPED.source, 'gi'), ' ')).rest.trim();
  return rest === '' || onlyFillers(rest);
};
const MEAT_FREE_TYPED = /\b(?:no|without)\s+meat\b|\bmeat[- ]?free\b|고기\s*없는|肉なし|无肉|無肉/gi;
const ASKS_INGREDIENT = { test: (query) => INGREDIENT_WORDS.test(String(query ?? '').replace(PORK_FREE_TYPED, ' ').replace(MEAT_FREE_TYPED, ' ').replace(/ドーナッツ|ココナッツ/g, '').trim()) };

// Is this reading of a search the search itself with words left out or cut
// short — no word of it spelt differently?
const onlyShorter = (typed, read) => {
  if (!read) return false;
  const words = String(typed).toLowerCase().split(/\s+/);
  return String(read).toLowerCase().split(/\s+/).every(w => words.some(t => t.startsWith(w)));
};

const PlaceCard = React.memo(function PlaceCard({ place, distanceKm, fromYou, bookmarked, onOpen, onToggleBookmark, onReadStory, onDirections, lens, stop = 0, at = null, atLabel = '' }) {
  const { t, i18n } = useTranslation();
  const stories = useStories(Boolean(lens));
  const storiesWaiting = useStoriesWaiting();
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
        <h3 className="place-card__name" translate="no">
          <button className="place-card__open-btn" aria-describedby={`pc-where-${place.id} pc-meta-${place.id} pc-claims-${place.id}`} onClick={() => onOpen(place)}>
            {/* In a journey, the same number as the stop's mark on the map. */}
            {/* Read as "Stop 1: EID…", not "1EID…". */}
            {stop > 0 && (
              <>
                <span className="place-card__stop" aria-hidden="true">{stop}</span>
                <span className="visually-hidden">{colon(t('detail.journeyPrev', { index: stop }), '')}</span>
              </>
            )}
            {name}
          </button>
        </h3>

        {/* Where, then when. Distance is from the map centre (the list
            header says so). Unknown hours are said, not left blank. */}
        <p className="place-card__where" id={`pc-where-${place.id}`}>
          <span className="place-card__zone">{placeArea(place)}</span>
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
              {atLabel && <span className="place-card__at">{colon(atLabel, '')}</span>}
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
        {lens && <p className="place-card__esg" lang={stories?.[place.id]?.esg ? i18n.language : undefined}>{stories?.[place.id]?.esg ?? (storiesWaiting ? '…' : place.esg_point)}</p>}
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
  inMapOnly = false, onShowAll,
  restaurants, onRestaurantClick, onReadStory, onDirections, onToggleBookmark, bookmarkedIds, mapCenter,
  sustainabilityLens, activeFilters = [], searchQuery = '', onClearFilters, missingPlace = null, unknownHours = 0,
  userLocation = null, sharedIds = [], sharedJourney = null, onSaveShared, onCloseShared, planAt = null, planDate = null, areaOnly = false, matchQuery = searchQuery, asked = searchQuery, onClearInline, onOpenNow, onPlan, onLocate, locateState = 'idle', fromYou = false, mapFramed = false, nearest = [], nearestFrom = '', fromStory = '', withoutEach = [], onDropFilter, showUnknown = false, onToggleUnknown, tick = 0, onSuggest, onPorkFree, withoutFilters = 0, onClearSearch,
}) {
  const { t, i18n } = useTranslation();
  // A Korean reader who typed Korean: "서울역" answered with “Seoul Station”도
  // 함께 검색했어요 read as if something else had been searched.
  const typedKorean = i18n.language === 'ko' && /[가-힣]/.test(searchQuery);
  // Ordered from the reader while the map has not been moved by hand since
  // "My location" answered — and something listed is within reach of them
  // (a search for Busan made from Seoul is ordered from the map, as before).
  const nearYou = Boolean(userLocation) && fromYou
    && restaurants.some((r) => { const c = coordsOf(r); return haversineKm(userLocation.lat, userLocation.lng, c.lat, c.lng) < 20; });
  const centredOnYou = nearYou || (Boolean(userLocation)
    && haversineKm(mapCenter[0], mapCenter[1], userLocation.lat, userLocation.lng) < 0.3);
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
              <p>{nearestFrom ? t('list.nearestTitle', { query: typedKorean ? koreanArea(nearestFrom) : listedArea(nearestFrom) ?? nearestFrom }) : t('list.nearResults')}</p>
              <ul className="saved-list">
                {nearest.map(({ place, km }) => (
                  <li key={place.id}>
                    <button type="button" className="saved-row" onClick={() => onRestaurantClick(place)}>
                      <span className="saved-row__main">
                        <span className="saved-row__name" translate="no">{displayName(place.name)}</span>
                        <span className="saved-row__where">{placeArea(place)} · {t('detail.nearbyAway', { distance: formatDistance(km) })}</span>
                        <span className="saved-row__claims">{dietaryBadges(place).map(b => <React.Fragment key={b.key}><ClaimChip kind={b.key} label={b.label} fact={b.fact} /><span className="visually-hidden">. </span></React.Fragment>)}</span>
                        {/* Whether it is open, as every other row says. */}
                        {(() => {
                          const st = planDate ? getOpenStatus(place.hours, planDate, { nameDay: true }) : getOpenStatus(place.hours);
                          return (
                            <span className="saved-row__status">
                              {st ? <>{planDate && planAt && <span className="place-card__at">{colon(t('filters.dayTime', { day: t(`hours.day.${DAY_KEYS[planAt.day]}`), time: formatClock(planAt.minutes) }), '')}</span>}<span className={statusClass(st)}>{st.label}</span>{st.detail && <> · {st.detail}</>}</> : <span className="place-card__unknown">{t('list.hoursUnknown')}</span>}
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
  // A filter or a search spread over the country — "Halal", 152 places from
  // Seoul to Jeju — is shown on a map drawn out to hold them all, and the
  // middle of that map is somewhere near Daejeon: the first card was a place
  // 140 km from anywhere most of them are. While the map stands as the app
  // drew it for that search (not moved by hand since), such a list starts where most of what it found is (the fullest patch of
  // some 17 km, by a count), and goes outwards from there.
  // Worked out once for a search and its chips, and kept while they stand:
  // with "Open now" on, the list changes on the minute, and the fullest patch
  // changed with it — the order turned over under the reader twice a morning.
  const heartFor = useRef({ key: null, at: null });
  const heart = useMemo(() => {
    const narrowed = searchQuery.trim() !== '' || activeFilters.some(f => f !== SHARED_LIST);
    if (!mapFramed || !narrowed || restaurants.length < 3) { heartFor.current = { key: null, at: null }; return null; }
    const asked = `${searchQuery.trim()}|${activeFilters.join(',')}`;
    if (heartFor.current.key === asked) return heartFor.current.at;
    let n = -90, s = 90, e = -180, w = 180;
    const cells = new Map();
    for (const r of restaurants) {
      const { lat, lng } = coordsOf(r);
      n = Math.max(n, lat); s = Math.min(s, lat); e = Math.max(e, lng); w = Math.min(w, lng);
      const key = `${Math.floor(lat / 0.15)}:${Math.floor(lng / 0.2)}`;
      const cell = cells.get(key) ?? { count: 0, lat: 0, lng: 0 };
      cell.count += 1; cell.lat += lat; cell.lng += lng;
      cells.set(key, cell);
    }
    // All in one town: the middle of the map is the middle of them.
    let most = null;
    for (const cell of cells.values()) if (!most || cell.count > most.count) most = cell;
    const at = haversineKm(n, w, s, e) < 40 ? null : [most.lat / most.count, most.lng / most.count];
    heartFor.current = { key: asked, at };
    return at;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, mapFramed, searchQuery, activeFilters.join(',')]);
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
        const fromCentre = haversineKm(mapCenter[0], mapCenter[1], lat, lng);
        const distanceKm = userLocation ? haversineKm(userLocation.lat, userLocation.lng, lat, lng) : fromCentre;
        const sortKm = nearYou ? distanceKm : heart ? haversineKm(heart[0], heart[1], lat, lng) : fromCentre;
        return { place: r, sortKm, distanceKm, fromYou: Boolean(userLocation), areaMatch: inArea(r), nameIs: typed !== '' && names(r).includes(typed) };
      })
      .sort((a, b) => (journeyOrder
        ? stop(a) - stop(b)
        : (b.nameIs - a.nameIs) || (b.areaMatch - a.areaMatch) || (a.sortKm - b.sortKm)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, mapCenter, matchQuery, userLocation, nearYou, heart, journeyOrder, sharedIds.join(',')]);
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
    if (halalOn && typeof window !== 'undefined' && window.innerHeight > 800) setNotesOpen(true);
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
  const [shown, setShown] = useState(() => (listMemory.key === restaurants.map(r => r.id).join(',') ? listMemory.shown : PAGE));
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
  const listRef = useRef(null);
  useLayoutEffect(() => {
    const box = listRef.current?.closest('.list-region');
    if (!box) return undefined;
    if (listMemory.key === listKey && listMemory.scrollTop > 0) box.scrollTop = listMemory.scrollTop;
    const onScroll = () => { listMemory.scrollTop = box.scrollTop; };
    box.addEventListener('scroll', onScroll, { passive: true });
    return () => box.removeEventListener('scroll', onScroll);
    // Once, when the list is drawn again: a new search scrolls by itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (listMemory.key !== listKey) listMemory.scrollTop = 0;
    listMemory.key = listKey;
    listMemory.shown = shown;
  }, [listKey, shown]);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return undefined;
    // Measured against the box the list scrolls in. Against the screen (no
    // root), the 400 px of warning was clipped by that box, and the next
    // page came only when the button itself scrolled into view.
    let root = el.parentElement;
    while (root && !/(auto|scroll)/.test(getComputedStyle(root).overflowY)) root = root.parentElement;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) setShown(s => s + PAGE);
    }, { root: root ?? null, rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, shown]);

  const plan = onPlan && !activeFilters.includes(OPEN_AT) ? plannedTime(searchQuery, koreaToday()) : null;
  const offerPlan = Boolean(plan && plan.sure);
  const offerOpenNow = Boolean(!plan?.sure && onOpenNow && !activeFilters.includes(OPEN_NOW) && asksOpenNow(searchQuery));
  const offerLocate = Boolean(onLocate && !fromYou && locateState !== 'located' && locateState !== 'asking' && asksNearMe(searchQuery, plan));
  const planLabel = plan ? t('filters.openAtSet', { day: t(`hours.day.${DAY_KEYS[plan.day]}`), time: formatClock(plan.minutes) }) : '';
  return (
    // The notes above the cards fold to two lines on a phone and open on a
    // tap: with a diet chip on they filled the half-height sheet and the
    // first result was under the tab bar.
    <div
      ref={listRef}
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

      {/* The list narrowed by the map's "Search this area": said here, with
          the way back to everything. */}
      {inMapOnly && (
        <p className="place-list__in-map">
          <span>{t('map.inViewOnly')}</span>
          <button type="button" onClick={onShowAll}>{t('map.showAll')}</button>
        </p>
      )}

      {/* "Pusan" or "釜山" was also searched as "Busan": say so, so the
          results are not a mystery and the spelling on signs is learned. */}
      {/* Not a half-romanised one ("Itaewon 로" for 이태원로): that was found
          by its Korean address, and the line only looked like a mistake. */}
      {/* Nor one that only left words out ("halal near me" as "halal",
          "noodles" as "noodle"): nothing was spelt another way. */}
      {searchQuery.trim() && matchQuery.trim() && !typedKorean && !fromStory && (romaniseQuery(matchQuery) || matchQuery !== asked) && !/[가-힣]/.test(romaniseQuery(matchQuery) ?? '') && !onlyShorter(matchQuery, romaniseQuery(matchQuery)) && (
        <p className="place-list__searched-as">{t('list.searchedAs', { query: romaniseQuery(matchQuery) ?? matchQuery })}</p>
      )}
      {fromStory && sorted.length > 0 && (
        <p className="place-list__searched-as">{t('list.fromStory', { query: fromStory })}</p>
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
      {/* "open now" typed into the search, with places found by those words
          in a name or a note: the chip is what was meant. (Outside the
          notes below, which are folded away when there is none.) */}
      {/* …and a day named in it ("saturday dinner halal", "내일 점심"): "Open
          at…" with that day and time. A weekday by itself may be a name
          ("Sun Hansik"), so over results only when a meal or "open" is said. */}
      {/* One band for whatever is offered: "내일 점심 근처 비건" asks two things,
          and two bands one under the other pushed the first card off a
          small screen. */}
      {sorted.length > 0 && (offerPlan || offerLocate || offerOpenNow) && (
        <p className="place-list__in-map place-list__in-map--offers">
          {offerPlan && <button type="button" onClick={() => onPlan(plan)}>{planLabel}</button>}
          {offerOpenNow && <button type="button" onClick={onOpenNow}>{t('list.showOpenNow')}</button>}
          {offerLocate && <button type="button" onClick={onLocate}>{t('map.nearMe')}</button>}
        </p>
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
      {/* "gluten free" finds 37 places, "dairy free" 14 — by a word in a
          place's notes, which nobody has checked dish by dish. The same
          caution an empty search for an allergen already gets, said over
          the results too: a list under that search read as a promise. */}
      {sorted.length > 0 && ASKS_INGREDIENT.test(searchQuery) && (
        <p className="section-note place-list__note place-list__note--key">{t('list.askStaffHint')} <Link to="/cards" state={{ fromApp: true, tab: 'map' }} onClick={(e) => e.stopPropagation()} onFocus={() => setNotesOpen(true)}>{t('profile.staffCards')}</Link></p>
      )}
      {/* With both diets on, why the list is short comes before all else. */}
      {activeFilters.includes('Halal') && activeFilters.includes('Vegan') && (
        <p className="section-note place-list__note">{t('list.bothDietsNote')}</p>
      )}
      {/* The halal caveat first: it is the one about safety, and behind
          the "Open now" note it was folded out of sight. */}
      {(halalOn || asksCertificate) && sorted.length > 0
        && !sorted.some(r => r.dietary?.halal?.value === 'certified') && (
        <p className="section-note place-list__note place-list__note--key">{t('list.halalCaveat')}</p>
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
          // Only a distance from the visitor is shown. Measured from the
          // middle of the map it read as "how far from me" to someone in
          // Jeju looking at a map that opens over Seoul, and Myeongdong's
          // own places read "5 km" under a search for Myeongdong.
          distanceKm={fromYou ? distanceKm : Infinity}
          fromYou={fromYou}
          tick={tick}
          stop={journeyOrder ? sharedIds.indexOf(r.id) + 1 : 0}
          at={planDate}
          atLabel={planDate && planAt ? t('filters.dayTime', { day: t(`hours.day.${DAY_KEYS[planAt.day]}`), time: formatClock(planAt.minutes) }) : ''}
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
                ...(searchQuery.trim() ? [quoted(searchQuery.trim())] : []),
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
          {plan && !plan.now && (
            <button type="button" className="place-list__clear" onClick={() => onPlan(plan)}>
              {planLabel}
            </button>
          )}
          {(!plan || plan.now) && onOpenNow && !activeFilters.includes(OPEN_NOW) && asksOpenNow(searchQuery) && (
            <button type="button" className="place-list__clear" onClick={onOpenNow}>
              {t('list.showOpenNow')}
            </button>
          )}
          {/* The chip that is in the way, by what taking it off would leave. */}
          {onDropFilter && withoutEach.slice(0, 3).map(({ filter, n }) => (
            <button key={filter} type="button" className="place-list__clear" onClick={() => onDropFilter(filter)}>
              {t('list.withoutOne', {
                filter: filter === OPEN_AT && planAt
                  ? t('filters.openAtSet', { day: t(`hours.day.${DAY_KEYS[planAt.day]}`), time: formatClock(planAt.minutes) })
                  : t(CHIP_LABEL_KEY[filter] ?? filter),
                n,
              })}
            </button>
          ))}
          {withoutFilters > 0 && (
            <p className="place-list__hint-text">{t('list.withoutFilters', { query: searchQuery.trim(), n: withoutFilters })}</p>
          )}
          {/* "peanut", "五辛", "알레르기": not on record for any place — the
              cards are where that question can be asked. */}
          {withoutFilters === 0 && ASKS_INGREDIENT.test(searchQuery) && (
            <p className="place-list__hint-text">{t('list.askStaffHint')} <Link to="/cards" state={{ fromApp: true, tab: 'map' }}>{t('profile.staffCards')}</Link></p>
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
