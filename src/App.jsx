import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useParams, useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { restaurants } from './data/restaurants';
import MapComponent from './components/MapComponent';
import MapErrorBoundary from './components/MapErrorBoundary';
import { prefetchPlaceRecords } from './hooks/usePlaceRecord';
import FilterBar from './components/FilterBar';
import BottomSheetList from './components/BottomSheetList';
import RestaurantDetail from './components/RestaurantDetail';
import TabBar from './components/TabBar';
import TabPanel from './components/TabPanel';
import JournalPanel from './components/JournalPanel';
import ConfirmHost from './components/ConfirmHost';
import { askConfirm } from './confirm';
import Prologue from './components/Prologue';
import SubmitSheet from './components/SubmitSheet';
import PrivacySheet from './components/PrivacySheet';
import StaffCardSheet from './components/StaffCardSheet';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import useAppUpdate from './hooks/useAppUpdate';
import { MAP_CENTER, getOpenStatus, koreaDateAt, koreaToday, coordsOf, haversineKm } from './utils';
import { readPosition, readError } from './data/locate';
import { journeys } from './data/journeys';
import { CHIP_GROUPS } from './i18n/labels';
import { journeyNav } from './data/journey-nav';
import { nearbyPlaces } from './data/nearby';
import { matchesDietary, isQuarantined } from './data/verification';
import { resolvePlace } from './data/leads';
import { loadLocalPassport, saveLocalPassport, savedOnly } from './data/passport';
import usePassportSync from './hooks/usePassportSync';
import { DIETARY_CHIPS, TRAIT_GROUPS, matchesSearch, matchesArea, matchesAreaWhole, matchesPhrase, OPEN_NOW, OPEN_AT, SAVED_ONLY, FULLY_VEGAN, matchesFullyVegan, SHARED_LIST, parseSharedList, viewHash, parseViewHash } from './filters';
import { fuzzyQuery } from './data/area-names';
import { takeFreshList } from './freshList';
import './index.css';

// Selecting anything on the sustainability axis — the group chip or either
// member — turns the list into a lens: each card states, in the restaurant's
// own recorded words, why it is here. Nothing new is written for this; the
// line is the esg_point already shown on the detail page.
const SUSTAINABILITY_AXIS = ['Sustainability', ...TRAIT_GROUPS.Sustainability];

// Quarantined records (existence itself unconfirmed) are excluded from every
// discovery surface — map, search, cards, Journal — at this single point.
const activeRestaurants = restaurants.filter(r => !isQuarantined(r));
// The same condition as index.css uses for a phone held sideways.
// A station named after its area: "Gangnam station", "gangnam stn", "강남역",
// "江南駅", with or without an exit number.
const STATION_TAIL = /(?:\s+(?:subway\s+)?(?:station|stn\.?)|역|駅|站)(?:\s+(?:exit|出口)?\s*\d+(?:번\s*출구)?)?$/i;
const LANDSCAPE_PHONE = '(max-width: 767px) and (orientation: landscape) and (max-height: 500px)';

const TAB_PATH = { map: '/', discover: '/discover', journal: '/journal', profile: '/profile' };
const PATH_TAB = { '/discover': 'discover', '/journal': 'journal', '/profile': 'profile' };

const NO_STOPS = [];
function useStableCallback(fn) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  return useCallback((...args) => ref.current(...args), []);
}
const findView = (pathname) => {
  // /find/halal-busan, or /find/halal for the whole country.
  const m = /^\/find\/(vegan|halal)(?:-([a-z]+))?\/?$/.exec(pathname);
  if (!m) return null;
  return { q: m[2] ? m[2][0].toUpperCase() + m[2].slice(1) : '', filters: [m[1] === 'vegan' ? 'Vegan' : 'Halal'], planAt: null, area: Boolean(m[2]) };
};
// Every chip a link may name (filters.js parseViewHash).
const VIEW_CHIPS = [OPEN_NOW, OPEN_AT, FULLY_VEGAN, ...CHIP_GROUPS.flatMap(g => g.chips.map(c => c.id))];

function AppShell() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const { updateReady, reload } = useAppUpdate();
  // The view named in the address fragment, read once: a reload, a tab the
  // phone dropped, or a link someone sent opens on the same search and chips.
  // An area guide's address (/find/halal-busan, prerendered for the web:
  // scripts/prerender-places.mjs) is that search and chip on the map.
  const [startView] = useState(() => findView(window.location.pathname) ?? parseViewHash(window.location.hash, VIEW_CHIPS));

  const [searchQuery, setSearchQuery] = useState(startView.q);
  // The search text names an area and only that (filters.js viewHash `a`):
  // set by an area guide or Discover's "Browse by area", so the list is the
  // same places the guide counted; dropped as soon as the text is edited.
  const [areaOnly, setAreaOnly] = useState(Boolean(startView.area));
  // A list in the address (/?list=a,b,c) opens the map on those places
  // only, as a filter the reader can close: a list someone shared, or a
  // journey's stops from Discover (&journey=<id> names it). Followed as the
  // address changes, so it also works when reached from inside the app.
  const readList = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      ids: parseSharedList(params.get('list'), activeRestaurants.map(r => r.id)),
      journeyId: params.get('journey'),
    };
  };
  const [sharedList, setSharedList] = useState(readList);
  const sharedIds = sharedList.ids;
  const sharedJourney = journeys.find(j => j.id === sharedList.journeyId) ?? null;
  const [selectedFilters, setSelectedFilters] = useState(() => [...(sharedIds.length > 0 ? [SHARED_LIST] : []), ...startView.filters]);
  // The URL is the source of truth for which restaurant is open — no
  // separate state to keep in sync. activeRestaurants already excludes
  // quarantined places, so an id that's quarantined or simply doesn't
  // exist both resolve to null here, and the effect below sends it home.
  const selectedRestaurant = useMemo(
    () => (id ? activeRestaurants.find(r => r.id === id) ?? null : null),
    [id],
  );
  const focusStory = Boolean(location.state?.focusStory);
  const focusDirections = Boolean(location.state?.focusDirections);
  const isSubmit = location.pathname === '/submit';
  const isPrivacy = location.pathname === '/privacy';
  // /cards: Korean text to show restaurant staff (StaffCardSheet).
  const isCards = location.pathname === '/cards';
  const submitPlace = useMemo(
    () => (isSubmit ? resolvePlace(new URLSearchParams(location.search).get('place'), activeRestaurants) : null),
    [isSubmit, location.search],
  );

  useEffect(() => {
    // An unknown or withdrawn place: say so on the map instead of silently
    // showing the home screen.
    if (id && !selectedRestaurant) navigate('/', { replace: true, state: { missingPlace: id } });
  }, [id, selectedRestaurant, navigate]);
  // State is the whole passport, tombstones included — a tombstone is the
  // only record that an unsave happened, and dropping it here would let the
  // next sync resurrect the place. Children still receive only saved entries.
  const [entries, setEntries] = useState(loadLocalPassport);
  // Tabs have addresses (/discover, /journal, /profile), so reload and the
  // phone's Back button keep you where you were. A place, the report form
  // or the privacy page opens over whichever tab is active and returns to it.
  // A place or sheet opened from the app records the tab it opened over in
  // history state, so a reload there keeps that tab behind it.
  const [activeTab, setActiveTab] = useState(() => PATH_TAB[location.pathname] ?? location.state?.tab ?? 'map');
  useEffect(() => {
    if (PATH_TAB[location.pathname]) setActiveTab(PATH_TAB[location.pathname]);
    else if (location.pathname === '/') setActiveTab('map');
  }, [location.pathname]);
  // The tab title names the screen, in the reader's language. A place and
  // the staff cards set their own while open (and restore this on close).
  useEffect(() => {
    if (id || ['/cards', '/privacy', '/submit'].includes(location.pathname)) return;
    const titles = {
      discover: t('discover.journeysTitle'),
      journal: t('journal.title'),
      profile: t('profile.settingsTitle'),
    };
    document.title = titles[activeTab]
      ? `${titles[activeTab]} · K-Food Map`
      : `K-Food Map · ${t('prologue.title').replace(/[.。]$/, '')}`;
  }, [activeTab, id, location.pathname, i18n.language, t]);
  // Only the map's own address decides the list: while a place or a sheet
  // is open over it, the list in force stays.
  useEffect(() => {
    if (location.pathname !== '/') return;
    const next = readList();
    setSharedList(prev => (prev.ids.join(',') === next.ids.join(',') && prev.journeyId === next.journeyId ? prev : next));
    // "Show these stops on the map" (Discover) asks for these places and
    // nothing else: a search or chips left on the map ("Hongdae" + Vegan)
    // were applied on top, and a Busan journey came up as "0 places".
    if (takeFreshList() && next.ids.length > 0) {
      setSearchQuery('');
      setAreaOnly(false);
      setSelectedFilters([SHARED_LIST]);
      return;
    }
    setSelectedFilters(prev => {
      const on = prev.includes(SHARED_LIST);
      if (next.ids.length > 0) return on ? prev : [...prev, SHARED_LIST];
      return on ? prev.filter(f => f !== SHARED_LIST) : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);
  // The map's address carries a list in force (a shared list, a journey),
  // so going back to the map — closing a place, a filter tapped with a
  // place open, the Map tab — keeps it instead of dropping it.
  const listQuery = selectedFilters.includes(SHARED_LIST) && sharedIds.length > 0
    ? `?list=${sharedIds.join(',')}${sharedList.journeyId ? `&journey=${encodeURIComponent(sharedList.journeyId)}` : ''}`
    : '';
  const pathOf = (tab) => (tab === 'map' ? `/${listQuery}` : TAB_PATH[tab] ?? '/');
  const tabPath = pathOf(activeTab);
  // The map is the bottom of the pile. From it a tab is one step forward;
  // tab to tab replaces that step; and back to the map is that step undone.
  // Each tab tap used to add an entry, so leaving the app took as many
  // Backs as there had been taps.
  const selectTab = (tab) => {
    // The address as it is now, not as the router last rendered it: two
    // tabs tapped in quick succession were both judged from the map.
    const path = window.location.pathname;
    const onTab = Boolean(PATH_TAB[path]);
    const onMap = path === '/';
    const here = window.history.state?.usr ?? null;
    if (tab === 'map') {
      if (onMap) return;                                   // already there: no new entry
      if (onTab && here?.overMap) navigate(-1);
      else navigate(pathOf('map'), { replace: true });
      return;
    }
    // Only a step taken from the map itself can be undone back to the map.
    // From a place open beside the list (wide screens) the tab replaces the
    // place, so "Map" does not bring the place back.
    if (onMap) navigate(pathOf(tab), { state: { overMap: true } });
    else navigate(pathOf(tab), { replace: true, state: onTab ? here : null });
  };
  // Below 768px a non-map tab covers the whole map. The map is then made
  // inert, so Tab never lands on a pin nobody can see (WCAG 2.4.11). From
  // 768px up the map stays visible beside the panel and stays usable.
  const [isWide, setIsWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(min-width: 768px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(min-width: 768px)');
    if (!mq) return undefined;
    const onChange = () => setIsWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const firstTab = useRef(true);
  useEffect(() => {
    if (firstTab.current) { firstTab.current = false; return; }
    if (activeTab === 'map') return;
    const heading = document.querySelector('.tab-panel h2, .journal-panel h2');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [activeTab]);
  const mapCovered = activeTab !== 'map' && !isWide;
  // The submit and privacy sheets are modal, and so is the detail on a
  // phone, where it covers the map: while one is open what lies behind it is
  // inert, so Tab stays inside. From 768px up the detail docks beside a
  // live map instead, and is not modal.
  const modalOpen = (Boolean(selectedRestaurant) && !isWide) || isSubmit || isPrivacy || isCards;
  const [mapCenter, setMapCenter] = useState(MAP_CENTER);
  // "My location" (data/locate.js): asked once per tap, kept in memory for
  // this visit only. `at` changes with every answer so the map knows to go
  // there again when the button is pressed a second time.
  const [userLocation, setUserLocation] = useState(null);
  const [locateState, setLocateState] = useState('idle'); // idle | asking | located | outside | denied | unavailable
  const locate = () => {
    if (!('geolocation' in navigator)) { setLocateState('unavailable'); return; }
    setLocateState('asking');
    // A permission prompt dismissed without an answer calls neither
    // callback, and `timeout` does not count the time spent on the prompt:
    // stop "asking" ourselves so the button is never stuck.
    const giveUp = setTimeout(() => setLocateState(s => (s === 'asking' ? 'unavailable' : s)), 20000);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(giveUp);
        const answer = readPosition(position);
        setLocateState(answer.state);
        setUserLocation(answer.state === 'located' ? { ...answer.location, at: Date.now() } : null);
      },
      (error) => { clearTimeout(giveUp); setLocateState(readError(error).state); setUserLocation(null); },
      // A recent fix is fine for "what is near me"; do not hold the radio on.
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sheetState, setSheetState] = useState(1); // 0: Collapsed, 1: Half, 2: Expanded
  const [handleDown, setHandleDown] = useState(false);
  // Which way the handle's next tap goes from the half height: down if the
  // sheet came there from full — by a tap, a drag or the list's scroll.
  const lastSheetState = useRef(1);
  useEffect(() => {
    if (sheetState === 1) setHandleDown(lastSheetState.current === 2);
    lastSheetState.current = sheetState;
  }, [sheetState]);
  const [prologueCompleted, setPrologueCompleted] = useState(
    // Arriving on a place or an area guide (a search result, a shared
    // link): that page is what was asked for, and the welcome screen stood
    // over it. Not marked as seen — it greets the next visit to the map.
    () => localStorage.getItem('kfm-prologue') === 'true' || /^\/(place|find)\//.test(window.location.pathname)
  );

  // The phone's list sheet follows the finger and settles on the nearest of
  // its three heights when let go. It used to wait for the finger to lift
  // and then jump a step, which read as the sheet not responding. The drag
  // is on the header (handle, search, chips); a sideways move there is the
  // chip row scrolling and is left alone.
  const sheetRef = useRef(null);
  const drag = useRef(null);
  // The three heights as CSS has them (index.css, "sheet-state-*"), measured
  // rather than repeated here: folded is the header over the tab bar, half
  // is 60 %, open leaves a strip of map.
  const sheetStops = (el) => {
    const full = el.parentElement?.getBoundingClientRect().height || window.innerHeight;
    const tabBar = document.querySelector('.tab-bar')?.getBoundingClientRect().height ?? 64;
    // A short phone's half sheet is a little taller (index.css): at 60 %
    // the first card was a name and nothing else.
    const half = window.matchMedia?.('(max-width: 767px) and (max-height: 700px) and (orientation: portrait)').matches ? 0.66 : 0.6;
    return [tabBar + 168, full * half, full - 92];
  };
  const handleTouchStart = (e) => {
    const el = sheetRef.current;
    // Phones only: from 768 px this is a sidebar, not a sheet.
    // Nor sideways, where the list is a panel that scrolls as a whole.
    if (!el || isWide || e.touches.length !== 1 || window.matchMedia?.(LANDSCAPE_PHONE).matches) { drag.current = null; return; }
    const touch = e.touches[0];
    drag.current = { id: touch.identifier, x: touch.clientX, y: touch.clientY, height: el.getBoundingClientRect().height, moved: false, last: touch.clientY, now: null, stops: sheetStops(el) };
  };
  const handleTouchMove = (e) => {
    const d = drag.current;
    const el = sheetRef.current;
    if (!d || !el) return;
    const touch = [...e.touches].find(tc => tc.identifier === d.id);
    if (!touch || e.touches.length !== 1) { handleTouchEnd(); return; }
    const dx = touch.clientX - d.x;
    const dy = touch.clientY - d.y;
    if (!d.moved) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) > Math.abs(dy)) { drag.current = null; return; }
      d.moved = true;
      el.style.transition = 'none';
    }
    const height = Math.min(d.stops[2], Math.max(d.stops[0] - 24, d.height - dy));
    el.style.height = `${height}px`;
    d.last = touch.clientY;
    d.now = height;
  };
  const handleTouchEnd = () => {
    const d = drag.current;
    const el = sheetRef.current;
    drag.current = null;
    if (!d || !el || !d.moved) return;
    el.style.transition = '';
    el.style.height = '';
    if (d.now == null) return;
    // The nearest stop — but a clear flick of 40 px or more moves at least
    // one step its way, so a short swipe is enough.
    const travelled = d.y - d.last;
    let next = d.stops.reduce((best, stop, i) => (Math.abs(stop - d.now) < Math.abs(d.stops[best] - d.now) ? i : best), 0);
    setSheetState((current) => {
      if (next === current && Math.abs(travelled) >= 40) next = Math.min(2, Math.max(0, current + (travelled > 0 ? 1 : -1)));
      return next;
    });
    // The list may be scrolled: do not let its next scroll event reopen a
    // sheet that was just pulled down.
    listTop.current = null;
  };
  // Scrolling down the list at half height asks for more list: open the
  // sheet fully rather than leave one and a half cards in view.
  // Only on a move further down the list, measured from the last scroll
  // position: a sheet pulled back to half height with the list already
  // scrolled used to spring open again at the next pixel.
  const listTop = useRef(null);
  const handleListScroll = (e) => {
    const top = e.currentTarget.scrollTop;
    const before = listTop.current;
    listTop.current = top;
    if (before !== null && sheetState === 1 && top > before && top > 48) setSheetState(2);
  };

  // Single choke point for every path that opens detail (map pin, card,
  // Journal stamp/next-stop) — a quarantined restaurant is a no-op here
  // rather than rendering unverified detail.
  // Opening a place from inside the app marks the entry (fromApp) so Close
  // can go back instead of stacking a new history entry — otherwise Android's
  // Back reopened the place just closed. A second place opened over the
  // first replaces it, so Close always returns to the tab.
  const openPlace = (r, extra = {}) => {
    if (isQuarantined(r)) return;
    if (r.id === id && !extra.focusStory && !extra.focusDirections) return;
    // A place replacing another keeps that one's footing: how deep the
    // pile is, and whether its bottom was opened inside the app at all (a
    // place arrived at by a link has nothing behind it to go back to).
    const here = id ? location.state : null;
    navigate(`/place/${r.id}`, {
      replace: Boolean(id),
      state: { fromApp: id ? Boolean(here?.fromApp) : true, tab: activeTab, depth: here?.depth ?? 0, ...extra },
    });
  };
  // From "Also nearby": a new step, so Back returns to the place it was
  // opened from rather than skipping to the list.
  const openFromPlace = (r) => {
    if (isQuarantined(r) || r.id === id) return;
    // Counted only above a place the app opened: from one reached by a
    // link, Close goes to the map (there is no list behind it to return to;
    // counting steps back from there left the app, or did nothing).
    const rooted = Boolean(location.state?.fromApp);
    navigate(`/place/${r.id}`, { state: { fromApp: rooted, tab: activeTab, depth: rooted ? (location.state?.depth ?? 0) + 1 : 0 } });
  };
  // Close returns to the list in one press, past any places opened one from
  // another (`depth`); Back still steps through them.
  const closePlace = () => (location.state?.fromApp ? navigate(-1 - (location.state?.depth ?? 0)) : navigate(tabPath, { replace: true }));
  // While a journey's stops are on the map, a stop opened from the map or
  // the list is opened as that stop, with the stop before and after.
  const openDetail = (r) => {
    const stop = sharedJourney && selectedFilters.includes(SHARED_LIST) ? sharedJourney.stopIds.indexOf(r.id) : -1;
    openPlace(r, stop >= 0 ? { journey: { id: sharedJourney.id, index: stop } } : {});
  };
  // What else is close to the open place (data/nearby.js) — under the
  // diet chips in force, so someone looking for halal is not offered the
  // pork restaurant next door. Search and "Open now" do not narrow it.
  const dietChips = selectedFilters.filter(f => DIETARY_CHIPS.includes(f) || f === FULLY_VEGAN);
  const dietKey = dietChips.join(',');
  const nearby = useMemo(() => nearbyPlaces(
    selectedRestaurant,
    activeRestaurants.filter(r => dietChips.every(f => (f === FULLY_VEGAN ? matchesFullyVegan(r) : matchesDietary(r, f)))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [selectedRestaurant, dietKey]);
  // A place opened from a journey (Discover) remembers which journey and
  // which stop, so the detail can offer the stop before and after. A stale
  // link, or a journey that lost a stop, is simply no journey.
  const journeyState = location.state?.journey;
  const journeyStops = useMemo(() => {
    const j = journeys.find(x => x.id === journeyState?.id);
    if (!j) return null;
    const stops = j.stopIds.map(sid => restaurants.find(r => r.id === sid));
    return stops.every(p => p && !isQuarantined(p)) ? { journey: j, stops } : null;
  }, [journeyState?.id]);
  const journey = journeyStops && journeyStops.stops[journeyState.index]?.id === id
    ? journeyNav(journeyStops.journey, journeyStops.stops, journeyState.index)
    : null;
  const openJourneyStop = (place, index) => openPlace(place, { tab: location.state?.tab ?? 'discover', journey: { id: journeyState.id, index } });
  const openStory = (r) => openPlace(r, { focusStory: true });
  // The card's directions button opens the place at its map-app buttons
  // (Naver and Kakao first), rather than straight to Google.
  const openDirections = (r) => openPlace(r, { focusDirections: true });

  // Local first, always: the device is written before any request goes out
  // and is never rolled back by one that fails.
  useEffect(() => {
    saveLocalPassport(entries);
  }, [entries]);

  const bookmarks = useMemo(() => savedOnly(entries), [entries]);
  const bookmarkedIds = useMemo(() => bookmarks.map(b => b.id), [bookmarks]);
  // Saved places should open fully offline, detail included.
  useEffect(() => { prefetchPlaceRecords(bookmarkedIds); }, [bookmarkedIds]);
  const visitedIds = useMemo(
    () => bookmarks.filter(b => b.visitedAt !== null).map(b => b.id),
    [bookmarks],
  );

  const { session, googleReady, signIn, signOut, deleteRecords, lastSyncFailed, sessionEnded, signInFailed } =
    usePassportSync({ entries, setEntries, isOnline });
  const sustainabilityLens = useMemo(
    () => selectedFilters.some(f => SUSTAINABILITY_AXIS.includes(f)),
    [selectedFilters],
  );

  // Typing a search with a place open (the search box stays in view beside
  // a docked place) shows the results: the place gives way, as for a filter.
  const handleSearchChange = (q) => {
    setSearchQuery(q);
    setAreaOnly(false);
    if (id) navigate(tabPath, { replace: true });
  };

  const handleToggleFilter = (filter) => {
    setSelectedFilters(prev => {
      if (prev.includes(filter)) return prev.filter(f => f !== filter);
      // "Open now" and "Open at…" ask the same question of two different
      // times: turning one on turns the other off.
      const other = filter === OPEN_NOW ? OPEN_AT : filter === OPEN_AT ? OPEN_NOW : null;
      return [...prev.filter(f => f !== other), filter];
    });
    // The day and time pickers take most of a phone's half-height sheet:
    // open it fully so the results are in view under them.
    if (filter === OPEN_AT) setSheetState(selectedFilters.includes(OPEN_AT) ? 1 : 2);
    if (id) navigate(tabPath, { replace: true });
  };

  // What a tap just did, said where the thumb is: saving from a card or the
  // place bar changed a heart's colour and nothing else, and the line that
  // did say it was half a screen away. One message at a time, gone after a
  // few seconds; an unsave can be undone from it.
  const [toast, setToast] = useState(null);
  const [toastHeld, setToastHeld] = useState(false);
  useEffect(() => {
    if (!toast) return undefined;
    // An Undo is given ten seconds, and waits while a finger or the focus
    // is on it: five was gone before a screen reader could reach it.
    if (toastHeld) return undefined;
    const timer = setTimeout(() => setToast(null), toast.undo ? 10000 : 3000);
    return () => clearTimeout(timer);
  }, [toast, toastHeld]);

  // Undo of an unsave: the save put back as it was, and said so.
  const restoreSave = (placeId, savedAt) => {
    const now = Date.now();
    // The time it was first saved, so it keeps its place in the Journal.
    setEntries(prev => prev.map(e => (e.id === placeId && e.savedAt === null ? { ...e, savedAt: savedAt ?? now, updatedAt: now } : e)));
    setToast({ text: t('detail.savedNote'), undo: null, at: now });
  };

  const handleToggleBookmark = async (placeId) => {
    // Unsaving a visited place also drops its visit (and its Journal seal),
    // so ask first rather than erase a record silently.
    const current = entries.find(e => e.id === placeId);
    if (current && current.savedAt !== null && current.visitedAt !== null
      && !(await askConfirm(t('journal.unsaveVisitedConfirm')))) return;
    const now = Date.now();
    const removing = Boolean(current && current.savedAt !== null);
    // An unsave that also dropped a visit was confirmed first and is not
    // offered back: Undo would restore the save without the visit.
    setToast(removing
      ? { text: t('detail.removedNote'), undo: current.visitedAt === null ? () => restoreSave(placeId, current.savedAt) : null, at: now }
      : { text: t('detail.savedNote'), undo: null, at: now });
    setEntries(prev => {
      const held = prev.find(e => e.id === placeId);
      if (!held || held.savedAt === null) {
        const fresh = { id: placeId, savedAt: now, visitedAt: null, updatedAt: now };
        return held ? prev.map(e => (e.id === placeId ? fresh : e)) : [...prev, fresh];
      }
      // Unsave: keep the row as a tombstone. The visit goes with the save,
      // exactly as it did when the entry was dropped outright.
      return prev.map(e => (e.id === placeId ? { ...e, savedAt: null, visitedAt: null, updatedAt: now } : e));
    });
  };

  // Marking a visit only ever edits an entry that is already saved, so the
  // invariant (visitedAt implies savedAt) holds by construction — this can
  // never create a record, and a tombstone is never revived into one.
  // "Been here" on a place not yet saved saves it and marks the visit in one
  // tap (a visit lives on a saved entry), rather than a disabled button
  // that never said why.
  // "Save all" on a shared list: every place not already saved, in one go.
  // An unsaved place's tombstone is revived, as a tap on its heart would.
  const saveMany = (ids) => {
    const now = Date.now();
    setEntries(prev => {
      const next = prev.map(e => (ids.includes(e.id) && e.savedAt === null
        ? { ...e, savedAt: now, visitedAt: null, updatedAt: now }
        : e));
      const held = new Set(prev.map(e => e.id));
      return [...next, ...ids.filter(pid => !held.has(pid)).map(pid => ({ id: pid, savedAt: now, visitedAt: null, updatedAt: now }))];
    });
  };
  const closeSharedList = () => {
    setSelectedFilters(prev => prev.filter(f => f !== SHARED_LIST));
    navigate('/', { replace: true });
  };

  const handleToggleVisited = async (placeId) => {
    // Taking a visit back removes its date and Journal seal: ask, as unsave does.
    const current = entries.find(e => e.id === placeId);
    if (current && current.savedAt !== null && current.visitedAt !== null
      && !(await askConfirm(t('journal.unvisitConfirm')))) return;
    const now = Date.now();
    // Marking a visit also saves the place and stamps the Journal: say so,
    // as a save does. Taking one back was just confirmed and needs no word.
    if (!current || current.visitedAt === null) setToast({ text: t('detail.visitedNote'), undo: null, at: now });
    setEntries(prev => {
      const held = prev.find(e => e.id === placeId);
      if (!held || held.savedAt === null) {
        const fresh = { id: placeId, savedAt: now, visitedAt: now, updatedAt: now };
        return held ? prev.map(e => (e.id === placeId ? fresh : e)) : [...prev, fresh];
      }
      return prev.map(e => (e.id === placeId
        ? { ...e, visitedAt: e.visitedAt === null ? now : null, updatedAt: now }
        : e));
    });
  };

  // The clock ticks every minute whatever is on, so "Open", "Last order
  // soon" and "Closed" on the cards and the open place stay true while the
  // app is left open, and are right at once when a phone wakes it. Only
  // "Open now" re-filters on the tick (filterClock): otherwise the list is
  // the same places and the map is not regrouped every minute.
  const openNowOn = selectedFilters.includes(OPEN_NOW);
  const [clock, setClock] = useState(() => Date.now());
  const filterClock = openNowOn ? clock : 0;
  // "Open at…": a weekday and a time in Korea, for planning tomorrow's
  // lunch or Sunday's dinner. Starts at noon tomorrow.
  const openAtOn = selectedFilters.includes(OPEN_AT);
  // "Open now" leaves out places whose hours were never recorded, and says
  // how many. The reader may ask to see them anyway; each card then says
  // its hours are not recorded. Off again with the filter.
  const [showUnknown, setShowUnknown] = useState(false);
  const includeUnknown = showUnknown && (openNowOn || openAtOn);
  useEffect(() => { if (!openNowOn && !openAtOn) setShowUnknown(false); }, [openNowOn, openAtOn]);
  const [planAt, setPlanAt] = useState(() => {
    if (startView.planAt) return startView.planAt;
    // The likeliest next meal: tonight's dinner until late afternoon in
    // Korea, tomorrow's lunch after that.
    const hour = new Date(Date.now() + 9 * 3600e3).getUTCHours();
    return hour < 17 ? { day: koreaToday(), minutes: 1140 } : { day: (koreaToday() + 1) % 7, minutes: 720 };
  });
  // …and written back as the view changes, on whatever page is showing, so
  // a reload from a place page returns to the same list. Replaces the
  // entry: typing a search does not fill the Back button.
  const wantHash = viewHash({ q: searchQuery, filters: selectedFilters, planAt, area: areaOnly });
  // Set by a change of view that should also land on the map (Discover →
  // an area): the write below then goes to "/", in one navigation, instead
  // of racing a separate navigate() against this effect.
  const toMap = useRef(false);
  useEffect(() => {
    // Read from the window, not from the router's `location`: navigate()
    // updates the address at once but the router's state a render later, and
    // a second chip tapped in between was judged against the old address
    // and undone (live QA, 2026-10-03).
    const here = window.location;
    // A guide's address has done its work once the view is set: it becomes
    // the map's own address, with the view in its fragment.
    const onGuide = here.pathname.startsWith('/find/');
    const goMap = onGuide || toMap.current;
    toMap.current = false;
    if (!goMap && viewHash(parseViewHash(here.hash, VIEW_CHIPS)) === wantHash) return;
    navigate(
      { pathname: goMap ? '/' : here.pathname, search: goMap ? '' : here.search, hash: wantHash },
      { replace: onGuide || !goMap, state: goMap ? null : (window.history.state?.usr ?? null) },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantHash, location.pathname, location.search, location.hash]);
  // A fragment typed or pasted into the open tab, or the one on the entry
  // Back or Forward lands on, is a view to show. Only the browser's own
  // events say so (the app's writes fire neither). `popstate` as well as
  // `hashchange`: it comes first, and the write-back above could otherwise
  // run in between and put the old view back over the new address.
  const wantHashRef = useRef(wantHash);
  useEffect(() => { wantHashRef.current = wantHash; });
  useEffect(() => {
    const onHashChange = () => {
      const view = parseViewHash(window.location.hash, VIEW_CHIPS);
      if (viewHash(view) === wantHashRef.current) return;
      setSearchQuery(view.q);
      setAreaOnly(view.area);
      setSelectedFilters(prev => [...prev.filter(f => f === SHARED_LIST || f === SAVED_ONLY), ...view.filters]);
      if (view.planAt) setPlanAt(view.planAt);
    };
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
    };
  }, []);
  const planDate = useMemo(
    () => (openAtOn ? koreaDateAt(planAt.day, planAt.minutes) : null),
    [openAtOn, planAt],
  );
  useEffect(() => {
    const tick = () => setClock(Date.now());
    tick();
    // On the minute, so a place closing at 9:00 leaves at 9:00; and at once
    // when the screen wakes, where timers have been asleep.
    let interval = null;
    const align = setTimeout(() => { tick(); interval = setInterval(tick, 60000); }, 60000 - (Date.now() % 60000));
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(align);
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // A new search or filter is read from its first result. The list is its
  // own scroller and kept its offset, so "Busan" typed halfway down a long
  // list opened near the end of the Busan results. Saving a place does not
  // come through here, so it keeps its position.
  useEffect(() => {
    document.getElementById('place-list')?.scrollTo?.({ top: 0 });
    // Sideways the whole panel is the scroller.
    if (window.matchMedia?.(LANDSCAPE_PHONE).matches) sheetRef.current?.scrollTo?.({ top: 0 });
  }, [selectedFilters, searchQuery, planAt]);

  // unknownHours: places that match everything else but have no recorded
  // hours for now — hidden by "Open now", and the list says how many.
  // matchQuery: the search actually used. It is the text as typed — unless
  // that finds nothing and one of its words is a single letter off a
  // well-known area ("myongdong"), in which case the corrected text is
  // tried, and the list says so.
  // The text in the box is drawn at once; the filter (and with it the
  // cards and several hundred map markers) follows a moment after the last
  // keystroke, so letters do not wait on the map. A plain timer rather than
  // useDeferredValue: the deferred value was seen to stay behind for good
  // in a background tab. An emptied box is answered at once.
  const [filterQuery, setFilterQuery] = useState(searchQuery);
  useEffect(() => {
    if (searchQuery === filterQuery) return undefined;
    if (searchQuery === '') { setFilterQuery(''); return undefined; }
    const id = setTimeout(() => setFilterQuery(searchQuery), 120);
    return () => clearTimeout(id);
  }, [searchQuery, filterQuery]);
  const { filteredRestaurants, unknownHours, matchQuery, nearest, nearestFrom } = useMemo(() => {
    const searchQuery = filterQuery; // eslint-disable-line no-shadow
    const now = planDate ?? new Date(filterClock || Date.now());
    let unknown = 0;
    let unknownPlaces = [];
    // 1. Filter chips (AND across chips). A dietary chip only matches on
    // evidence — an unknown dietary record never matches, so we never send
    // someone somewhere we can't vouch for. A group chip ORs within itself.
    const chips = (r) => selectedFilters.every(f => {
        if (f === OPEN_NOW || f === OPEN_AT) return true; // asked last, below
        if (f === SAVED_ONLY) return bookmarkedIds.includes(r.id);
        if (f === SHARED_LIST) return sharedIds.includes(r.id);
        if (f === FULLY_VEGAN) return matchesFullyVegan(r);
        if (DIETARY_CHIPS.includes(f)) return matchesDietary(r, f);
        const group = TRAIT_GROUPS[f];
        return group ? r.traits.some(t => group.includes(t)) : r.traits.includes(f);
    });
    const run = (query) => activeRestaurants.filter(r => {
      // 2. Free-text search: name, vibe, area and street address.
      if (!chips(r) || !(areaOnly ? matchesArea(r, query) : matchesSearch(r, query))) return false;
      if (!openNowOn && !openAtOn) return true;
      const status = getOpenStatus(r.hours, now);
      if (status === null) { unknown += 1; unknownPlaces.push(r); return includeUnknown; }
      // Open but past last order is no use to someone who wants to eat now.
      return status.open === true && status.orderable !== false;
    });
    let list = run(searchQuery);
    let used = searchQuery;
    // "seoul station": the records that say exactly that, when any do.
    if (!areaOnly && searchQuery.trim().includes(' ')) {
      const exact = list.filter(r => matchesPhrase(r, searchQuery));
      if (exact.length > 0 && exact.length < list.length) {
        list = exact;
        // The count of places hidden for having no hours follows the list.
        unknown = unknownPlaces.filter(r => matchesPhrase(r, searchQuery)).length;
      }
    }
    if (list.length === 0 && searchQuery.trim() && !areaOnly) {
      const guess = fuzzyQuery(searchQuery);
      if (guess) {
        unknown = 0;
        unknownPlaces = [];
        const again = run(guess);
        if (again.length > 0) { list = again; used = guess; }
      }
    }
    // "Gangnam station", "강남역", "Gangnam Station exit 10": no record says
    // so in those words, but the area is on record. Tried without the word
    // for the station when the search as typed finds nothing.
    if (list.length === 0 && searchQuery.trim() && !areaOnly) {
      const bare = searchQuery.trim().replace(STATION_TAIL, '').trim();
      if (bare && bare !== searchQuery.trim()) {
        unknown = 0;
        unknownPlaces = [];
        const again = run(bare);
        if (again.length > 0) { list = again; used = bare; }
      }
    }
    // An area with nothing that matches the chips ("Haeundae" + Halal): the
    // closest places that do, measured from the middle of that area's
    // records. Only for a search that names an area we hold records in.
    let near = [];
    // Also when the area has only one or two ("Hongdae" + Fully vegan at
    // Monday noon is one place; Mangwon is 750 m away).
    if (list.length < 3 && searchQuery.trim() && selectedFilters.length > 0
      && !selectedFilters.includes(SAVED_ONLY) && !selectedFilters.includes(SHARED_LIST)) {
      // Measured from the one or two places found, when there are any; with
      // none, from the area the whole search names. Never from a place that
      // only shares a word with it: "Lotte World" was once measured from a
      // street called World Cup buk-ro, 13 km away.
      const anchors = (list.length > 0 ? list : activeRestaurants.filter(r => matchesAreaWhole(r, used))).map(coordsOf);
      const reach = list.length > 0 ? 5 : 40;
      if (anchors.length > 0) {
        const lat = anchors.reduce((sum, c) => sum + c.lat, 0) / anchors.length;
        const lng = anchors.reduce((sum, c) => sum + c.lng, 0) / anchors.length;
        // "Seo-gu" is a district in six cities: its middle is a mountain.
        const spread = Math.max(...anchors.map(c => haversineKm(lat, lng, c.lat, c.lng)));
        if (spread <= 30) near = activeRestaurants
          .filter(r => {
            if (!chips(r) || list.includes(r)) return false;
            if (!openNowOn && !openAtOn) return true;
            const status = getOpenStatus(r.hours, now);
            return status?.open === true && status.orderable !== false;
          })
          .map(r => { const c = coordsOf(r); return { place: r, km: haversineKm(lat, lng, c.lat, c.lng) }; })
          .filter(x => x.km <= reach)
          .sort((a, b) => a.km - b.km)
          .slice(0, 3);
      }
    }
    // nearestFrom: the area the distances are from, or '' when they are from
    // the places found (the list then says "close to these").
    return { filteredRestaurants: list, unknownHours: unknown, matchQuery: used, nearest: near, nearestFrom: list.length > 0 ? '' : used.trim() };
  }, [selectedFilters, filterQuery, areaOnly, openNowOn, openAtOn, includeUnknown, planDate, filterClock, bookmarkedIds, sharedIds]);

  // The same function object on every render, always calling the latest
  // version: what lets the memoised map skip renders it does not need.
  const openDetailStable = useStableCallback(openDetail);
  const openStoryStable = useStableCallback(openStory);
  const openDirectionsStable = useStableCallback(openDirections);
  const toggleBookmarkStable = useStableCallback(handleToggleBookmark);
  const locateStable = useStableCallback(locate);

  if (!prologueCompleted) {
    return (
      <Prologue 
        onComplete={(diet) => {
          localStorage.setItem('kfm-prologue', 'true');
          setPrologueCompleted(true);
          // The diet picked on the welcome screen turns its chip on.
          if (Array.isArray(diet) && diet.length > 0) {
            setSelectedFilters(prev => [...prev, ...diet.filter(d => !prev.includes(d))]);
          }
        }}
      />
    );
  }

  return (
    <main className={`app-shell ${isSidebarCollapsed ? 'is-collapsed' : ''}`}>
      {/* The page's one H1, for screen readers and outlines; the map screen
          has no visible title. */}
      <h1 className="visually-hidden">K-Food Map</h1>
      {/* The map holds hundreds of focusable pins; the same places are in
          the list, one Tab away with this link. */}
      {activeTab === 'map' && !modalOpen && <a className="skip-link" href="#place-list">{t('app.skipToList')}</a>}
      {/* Above everything, on every tab: inside the map region they sat under
          the pins and vanished behind the other tabs and the sheets. */}
      {!isOnline && (
        <div className="offline-banner" role="status">
          {t('app.offline')}
        </div>
      )}
      {/* Only offered when the page was already in use as the new version
          arrived; an untouched page reloads itself (useAppUpdate). */}
      {updateReady && (
        <button type="button" className="update-banner" onClick={reload}>
          {t('app.updateReady')}
        </button>
      )}
      {/* The live region is always in the page and only its content comes and
          goes: a status region inserted together with its text is not read
          out by every screen reader. */}
      <div className="toast-region" role="status" aria-live="polite" onFocus={() => setToastHeld(true)} onBlur={() => setToastHeld(false)} onPointerEnter={() => setToastHeld(true)} onPointerLeave={() => setToastHeld(false)}>
        {toast && (
          <div className={`toast${selectedRestaurant && !isWide ? ' toast--over-place' : ''}`} key={toast.at}>
            <span>{toast.text}</span>
            {toast.undo && (
              <button type="button" className="toast__undo" onClick={() => { const undo = toast.undo; setToast(null); undo(); }}>
                {t('app.undo')}
              </button>
            )}
          </div>
        )}
      </div>
      <ConfirmHost />
      {/* Map is now at the base level */}
      <div className="map-region" inert={mapCovered || modalOpen || undefined}>
        <MapErrorBoundary>
          <MapComponent
            restaurants={filteredRestaurants}
            onMarkerClick={openDetailStable}
            selectedId={selectedRestaurant?.id}
            onCenterChange={setMapCenter}
            searchQuery={matchQuery}
            fitAll={selectedFilters.includes(SAVED_ONLY) || selectedFilters.includes(SHARED_LIST)}
            savedIds={bookmarkedIds}
            stopIds={sharedJourney && selectedFilters.includes(SHARED_LIST) ? sharedIds : NO_STOPS}
            userLocation={userLocation}
            locateState={locateState}
            onLocate={locateStable}
            sheetState={sheetState}
          />
        </MapErrorBoundary>
      </div>

      <div ref={sheetRef} className={`sidebar-region ${activeTab === 'map' ? `sheet-state-${sheetState}` : 'non-map-tab'}`} inert={modalOpen || undefined}>
        {/* Render Map Items ONLY when activeTab is 'map' */}
        {activeTab === 'map' && (
          <>
            {/* Mobile handle and header wrapped for touch events */}
            <div 
              className="sheet-header-drag-area"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
            >
              {/* Dragging is not the only way to resize the sheet (WCAG 2.5.7):
                  the handle is a button that steps through the three heights. */}
              <button
                type="button"
                className="sheet-handle-area"
                aria-label={t(sheetState === 0 ? 'app.sheetExpand' : sheetState === 2 || handleDown ? 'app.sheetCollapse' : 'app.sheetExpandFull')}
                // Up a step at a time, then down a step at a time: from full
                // a tap used to drop straight to folded, past the half
                // height where the map and the list are both in view.
                onClick={() => setSheetState(sheetState === 1 ? (handleDown ? 0 : 2) : 1)}
              >
                <span className="sheet-handle-bar" aria-hidden="true" />
              </button>

              {/* Search + dietary filters */}
              <FilterBar
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                // Typing on a phone: the keyboard takes the lower half, so
                // the sheet opens fully and the results show above it.
                onSearchFocus={() => setSheetState(2)}
                selectedFilters={selectedFilters}
                onToggleFilter={handleToggleFilter}
                planAt={planAt}
                onPlanAt={setPlanAt}
                savedCount={bookmarkedIds.length}
              />
            </div>

            {/* Restaurant list */}
            <section className="list-region" id="place-list" tabIndex={-1} aria-label={t('app.restaurantList')} onScroll={handleListScroll}>
              <BottomSheetList
                restaurants={filteredRestaurants}
                mapCenter={mapCenter}
                userLocation={userLocation}
                bookmarkedIds={bookmarkedIds}
                onRestaurantClick={openDetailStable}
                onReadStory={openStoryStable}
                onDirections={openDirectionsStable}
                onToggleBookmark={toggleBookmarkStable}
                tick={clock}
                sustainabilityLens={sustainabilityLens}
                activeFilters={selectedFilters}
                unknownHours={unknownHours}
                showUnknown={includeUnknown}
                onToggleUnknown={() => setShowUnknown(v => !v)}
                planAt={planAt}
                planDate={planDate}
                areaOnly={areaOnly}
                sharedIds={sharedIds}
                sharedJourney={sharedJourney}
                onSaveShared={() => saveMany(sharedIds)}
                onCloseShared={closeSharedList}
                // The query the list was filtered by (a keystroke behind at most),
                // so its notes and its cards speak of the same search.
                searchQuery={filterQuery}
                matchQuery={matchQuery}
                nearest={nearest}
                nearestFrom={nearestFrom}
                // Nothing found for a name: the way to tell us about it,
                // with the name already written.
                onSuggest={(name) => navigate('/submit', { state: { fromApp: true, tab: 'map', name } })}
                onClearInline={() => {
                  // From the list header: chips and search off, where the
                  // reader is — no keyboard, and a shared list or journey stays.
                  setSelectedFilters(prev => prev.filter(f => f === SHARED_LIST));
                  setSearchQuery('');
                  setAreaOnly(false);
                }}
                onClearFilters={() => {
                  // A shared list lives in the address too; clear it there,
                  // or a reload brings the filter back.
                  if (selectedFilters.includes(SHARED_LIST)) navigate('/', { replace: true });
                  setSelectedFilters([]);
                  setSearchQuery('');
                  setAreaOnly(false);
                  // The button goes with the empty state; put focus where the
                  // next search starts.
                  document.querySelector('.search-field input')?.focus();
                }}
                missingPlace={location.state?.missingPlace ?? null}
              />
            </section>
          </>
        )}

        {/* Tab panels rendered inside the sidebar */}
        {activeTab === 'journal' && (
          <JournalPanel bookmarks={bookmarks} planAt={openAtOn ? planAt : null} planDate={openAtOn ? planDate : null} onRestaurantClick={openDetail} sessionEnded={sessionEnded && !session} onGoMap={() => selectTab('map')} />
        )}
        {activeTab !== 'map' && activeTab !== 'journal' && (
          <TabPanel
            tab={activeTab}
            onNavigate={selectTab}
            session={session}
            googleReady={googleReady}
            onSignIn={signIn}
            onSignOut={signOut}
            onDeleteRecords={deleteRecords}
            lastSyncFailed={lastSyncFailed}
            sessionEnded={sessionEnded}
            signInFailed={signInFailed}
            savedCount={bookmarks.length}
            visitedCount={visitedIds.length}
            onBrowse={(chip, area) => {
              // Discover → an area: the map on that search and that chip alone.
              const next = viewHash({ q: area, filters: [chip], planAt, area: true });
              if (next === wantHash) { navigate({ pathname: '/', hash: wantHash }); return; }
              toMap.current = true;
              setSearchQuery(area);
              setAreaOnly(true);
              setSelectedFilters([chip]);
            }}
          />
        )}

        <TabBar 
          activeTab={activeTab} 
          onSelect={selectTab} 
          isCollapsed={isSidebarCollapsed} 
          savedCount={bookmarkedIds.length}
        />
      </div>

      <div className="border-region" inert={modalOpen || undefined}>
        <button 
          className="sidebar-toggle"
          aria-label={isSidebarCollapsed ? t('app.sidebarExpand') : t('app.sidebarCollapse')}
          onClick={() => setIsSidebarCollapsed(prev => !prev)}
        >
          {isSidebarCollapsed ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          )}
        </button>
      </div>

      {/* Layer 2: Full-Screen Detail Modal */}
      <RestaurantDetail
        restaurant={selectedRestaurant}
        onClose={closePlace}
        isBookmarked={selectedRestaurant ? bookmarkedIds.includes(selectedRestaurant.id) : false}
        onToggleBookmark={handleToggleBookmark}
        isVisited={selectedRestaurant ? visitedIds.includes(selectedRestaurant.id) : false}
        onToggleVisited={handleToggleVisited}
        // A distance "from map centre" only means something to someone who
        // was looking at the map; from a shared link it measured from a
        // default centre they never saw.
        mapCenter={location.state?.fromApp ? mapCenter : null}
        userLocation={userLocation}
        journey={journey}
        onJourneyStop={openJourneyStop}
        nearby={nearby}
        nearbyDiet={dietChips}
        planAt={planAt}
        planDate={planDate}
        onOpenPlace={openFromPlace}
        focusStory={focusStory}
        focusDirections={focusDirections}
        docked={isWide}
        belowSearch={activeTab === 'map'}
      />

      {isSubmit && (
        <SubmitSheet
          key={location.search}
          place={submitPlace}
          initialName={location.state?.name ?? ''}
          // Opened from inside the app, it closes by going back — to the
          // place or the tab it came from, without a second copy of either.
          onClose={() => (location.state?.fromApp ? navigate(-1) : navigate(submitPlace ? `/place/${submitPlace.id}` : tabPath, { replace: true }))}
        />
      )}
      {isPrivacy && <PrivacySheet onClose={() => (location.state?.fromApp ? navigate(-1) : navigate(tabPath, { replace: true }))} />}
      {/* Opened from a place, the cards close back to that place. */}
      {isCards && (
        <StaffCardSheet
          // No card named in the address: the one for the diet the reader
          // has filtered by (Halal alone → the Muslim card).
          initialCard={new URLSearchParams(location.search).get('card')
            ?? (selectedFilters.includes('Halal') && !selectedFilters.includes('Vegan') && !selectedFilters.includes(FULLY_VEGAN) ? 'muslim' : null)}
          onClose={() => (location.state?.fromApp ? navigate(-1) : navigate(tabPath, { replace: true }))}
          onCardChange={(card) => navigate(`/cards?card=${card}`, { replace: true, state: location.state })}
        />
      )}

    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />} />
      <Route path="/place/:id" element={<AppShell />} />
      <Route path="/submit" element={<AppShell />} />
      <Route path="/privacy" element={<AppShell />} />
      <Route path="/cards" element={<AppShell />} />
      {/* Anything else (/discover, an old link) lands on the map, not on a
          blank page. */}
      <Route path="*" element={<AppShell />} />
    </Routes>
  );
}
