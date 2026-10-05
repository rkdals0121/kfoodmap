import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useStories } from '../hooks/useStories';
import { placeArea } from '../place-area';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigationType } from 'react-router';
import { useTranslation, Trans } from 'react-i18next';
import PlaceImage from './PlaceImage';
import {
  HeartIcon, CompassIcon, XIcon, ClockIcon, MapPinIcon, CrescentIcon,
  MildIcon, FermentIcon, SproutIcon, RecycleIcon, LeafIcon,
  BookIcon, BowlIcon, MenuIcon, TrainIcon, PhoneIcon, LinkIcon, SealIcon, ShareIcon, InfoIcon,
  ChevronLeftIcon, ChevronRightIcon,
} from './Icons';
import { getCulture } from '../data/culture';
import { haversineKm, formatDistance, getOpenStatus, todaysHours, directionsUrl, naverMapUrl, kakaoMapUrl, coordsOf, formatLongDate, displayName, deviceOnKoreaTime, koreaClock, koreanName, weekHours, statusClass, DAY_KEYS, formatClock } from '../utils';
import { koAddress } from '../data/address-ko';
import { koStation, koLine } from '../data/station-ko';
import {
  dietaryBadges, isKnown, needsCheck, trustBadge, dietaryConfidence, CONFIDENCE, VEGAN, HALAL,
} from '../data/verification';
import { sourceLabel } from '../i18n/labels';
import usePlaceRecord from '../hooks/usePlaceRecord';
import { useBackToClose, useWakeLock, useFitText, useInertRoot, focusAfterOverlay } from '../hooks/useOverlay';
import { copyText, shareOrCopy } from '../share';
import { CLAIM_CLASS } from './claim';
import { cardForPlace } from '../data/staff-cards';
import ClaimChip from './ClaimChip';
import KoText from './KoText';

// Keyed by the identifier as stored in restaurant.traits / compared in
// App.jsx's trait groups (see src/i18n/labels.js for the same pattern with
// source/method values) — only labelKey is translated, the id stays.
const TRAIT_META = {
  'Mild Taste': { Icon: MildIcon, labelKey: 'detail.traitMildTaste' },
  'Fermented': { Icon: FermentIcon, labelKey: 'detail.traitFermented' },
  'Zero-waste': { Icon: RecycleIcon, labelKey: 'detail.traitZeroWaste' },
  'Local Sourcing': { Icon: SproutIcon, labelKey: 'detail.traitLocallySourced' },
};

const DIETARY_ICON = { vegan: LeafIcon, halal: CrescentIcon };

function SectionHead({ Icon, title, kr }) {
  const { i18n } = useTranslation();
  // The Korean gloss beside a heading is for readers of other languages; in
  // Korean it would only repeat the heading.
  if (i18n.language === 'ko') kr = null;
  return (
    <div className="section-head">
      <span className="section-head__icon" aria-hidden="true"><Icon size={17} /></span>
      <h3>{title}{kr && <span className="section-head__kr" lang="ko"> · {kr}</span>}</h3>
    </div>
  );
}

// Menu prices as one format: most records say "14,000 KRW", 91 dishes carry
// a bare "11000", and a few carry a placeholder word ("unknown") that is
// not a price.
function formatPrice(price) {
  const p = typeof price === 'number' ? String(price) : (price ?? '').trim();
  if (/^\d+$/.test(p)) return `${Number(p).toLocaleString('en-US')} KRW`;
  if (p === '' || /^(unknown|price not listed)$/i.test(p)) return null;
  return p;
}

// Where a claim was read, by site: "The restaurant (mahinavegan.com)" and
// "The restaurant (instagram.com)" are different grades of the same source,
// and the page has to show why one is Confirmed and the other Reported.
// The URL arrives with the full record; until then the source alone.
function sourceWithSite(f) {
  let host = null;
  try { host = f.url ? new URL(f.url).hostname.replace(/^www\./, '') : null; } catch { host = null; }
  return host ? `${sourceLabel(f.source)} (${host})` : sourceLabel(f.source);
}

// A dietary fact is a button: tapping it opens the source and reasoning
// below the row. This used to live in a hover tooltip, which a phone
// never shows.
// A research note is shown as written, except for the labels it borrows
// from the code ("held at SUPPORTED", "not grounds for HALAL.CERTIFIED"):
// those are given as the words the app shows for them.
// Printed hours in pieces that hold together: each range, and each
// bracketed last order, wraps as a whole or not at all.
const hoursPieces = (text) => String(text).split(', ').map((slot, i, all) => {
  const k = slot.indexOf(' (');
  const parts = k > 0 ? [slot.slice(0, k), slot.slice(k + 1)] : [slot];
  return (
    <React.Fragment key={slot}>
      {parts.map((part, j) => <React.Fragment key={part}>{j > 0 && ' '}<span className="hours-piece">{part}</span></React.Fragment>)}
      {i < all.length - 1 && ', '}
    </React.Fragment>
  );
});

// Where each place's page was scrolled to, for this visit.
const scrollMemory = new Map();

const NOTE_TERMS = [
  [/\bHALAL\.CERTIFIED\b/g, '“Halal certified”'],
  [/\bHALAL\.FRIENDLY\b|\bFRIENDLY\b/g, '“Halal-friendly”'],
  [/\bHALAL\.PORK_FREE\b|\bPORK_FREE\b/g, '“Pork-free”'],
  // With its article, so "no halalCertClaim is recorded" stays a sentence.
  [/\b(?:in |an? |no )?halalCertClaim\b/g, (m) => (m.startsWith('no ') ? 'no certification claim' : m.startsWith('in ') ? 'as a certification claim' : 'a certification claim')],
  [/\bCERTIFIED\b/g, '“Halal certified”'],
  [/\bporkFree\b/g, '“Pork-free”'],
  [/\bNONE\b/g, '“none”'],
  [/\bCOMMUNITY\b/g, 'a community source'],
  [/\bVEGAN\.FULL\b|\bFULL\b/g, '“Fully vegan”'],
  [/\bVEGAN\.OPTIONS\b|\bOPTIONS\b/g, '“Vegan options”'],
  [/\bCONFIRMED\b/g, '“Confirmed”'],
  [/\bSUPPORTED\b/g, '“Reported”'],
  [/\bINFERRED\b/g, '“Our reading”'],
  // The notes' workshop words — which tool read a page, which pass of the
  // research, which other record set the rule. Said plainly or left out;
  // what was read and what it said are untouched.
  [/ with curl(?: as raw HTML)?/g, ''],
  [/\bthe [a-z0-9-]+ researcher\b/g, 'an earlier check'],
  [/ \((?:the )?[a-z0-9-]+ precedent\)/g, ''],
  [/\ba batch-?\d+ reading\b/g, 'an earlier reading'],
  [/\(noted in batch \d+\)/g, '(noted earlier)'],
  [/\b(a|A)n earlier batch\b/g, (m, a) => `${a}n earlier check`],
  [/\bReviewer note: /g, 'Note: '],
];
const plainNote = (text) => NOTE_TERMS.reduce((out, [re, word]) => out.replace(re, word), String(text ?? ''));
// A web address inside a note becomes a link named by its site: as bare
// text it ran 100 characters wide and could not be opened.
const noteWithLinks = (text) => text.split(/(https?:\/\/\S+)/).map((part, k) => {
  if (k % 2 === 0) return part;
  // What closes the sentence or the bracket around it is not the address.
  const tail = /[).,;:'"”]+$/.exec(part)?.[0] ?? '';
  const href = tail ? part.slice(0, -tail.length) : part;
  let host = href;
  try { host = new URL(href).hostname.replace(/^www\./, ''); } catch { /* shown as written */ }
  return <React.Fragment key={k}><a href={href} target="_blank" rel="noopener noreferrer">{host}</a>{tail}</React.Fragment>;
});

function ClaimFact({ id, Icon, label, fact, open, onToggle }) {
  const { t } = useTranslation();
  const { label: level, tone } = trustBadge(fact);
  return (
    <li>
      <button
        type="button"
        className={`fact claim claim-fact claim--${CLAIM_CLASS[tone]}`}
        aria-expanded={open}
        aria-controls={`claim-explain-${id}`}
        onClick={onToggle}
      >
        {Icon && <Icon size={16} aria-hidden="true" />} {label}
        <span className="claim-fact__level">{level}</span>
        {/* The word, not only the mark: a first-time reader did not take
            the chip for something that opens. */}
        <span className="claim-fact__why" aria-hidden="true">{t('detail.claimWhy')}<InfoIcon size={14} /></span>
      </button>
    </li>
  );
}

// Keyed by confidence level; titleKey/bodyKey are resolved with t() inside
// the component (module scope can't call useTranslation's t and still react
// to a language change — see the coordinator note in the fix-round report).
const DIET_CAVEAT_KEYS = {
  [CONFIDENCE.CONFIRMED]: { titleKey: 'detail.caveatConfirmedTitle', bodyKey: 'detail.caveatConfirmedBody' },
  [CONFIDENCE.SUPPORTED]: { titleKey: 'detail.caveatSupportedTitle', bodyKey: 'detail.caveatSupportedBody' },
  [CONFIDENCE.INFERRED]: { titleKey: 'detail.caveatInferredTitle', bodyKey: 'detail.caveatInferredBody' },
  [CONFIDENCE.UNKNOWN]: { titleKey: 'detail.caveatUnknownTitle', bodyKey: 'detail.caveatUnknownBody' },
};

// A Korean number as a link that also dials from a foreign SIM: 02-123-4567
// → +8221234567. Anything not starting with 0 is left as written.
const telHref = (n) => { const d = String(n).replace(/[^0-9+]/g, ''); return d.startsWith('0') ? `+82${d.slice(1)}` : d; };

export default function RestaurantDetail({
  restaurant, onClose, isBookmarked, onToggleBookmark, isVisited, onToggleVisited, userLocation = null, isOnline = true,
  journey = null, onJourneyStop, nearby = [], nearbyDiet = [], onOpenPlace, planAt = null, planDate = null,
  mapCenter, focusStory, focusDirections = false, docked = false, belowSearch = false, peek = false, onExpand,
}) {
  const { t, i18n } = useTranslation();
  const stories = useStories();
  const location = useLocation();
  const [copied, setCopied] = useState(false);
  const [koAddrCopied, setKoAddrCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [openClaim, setOpenClaim] = useState(null);
  const [claimFull, setClaimFull] = useState(false);
  useEffect(() => { setClaimFull(false); }, [openClaim, restaurant?.id]);
  // The Korean name on the whole screen, to show a driver or a passer-by.
  const [nameLarge, setNameLarge] = useState(false);
  const [nameCopied, setNameCopied] = useState(false);
  const nameLargeBtn = useRef(null);
  // Closing gives focus back to the button that opened it.
  const closeNameLarge = () => { setNameLarge(false); focusAfterOverlay(nameLargeBtn.current); };
  useBackToClose(nameLarge, closeNameLarge);
  // Another place opened in this sheet: the large name does not carry over.
  useEffect(() => { setNameLarge(false); }, [restaurant?.id]);
  useWakeLock(nameLarge);
  useInertRoot(nameLarge);
  const nameLargeText = useRef(null);
  // As large as fits, but never so large that a name stands one syllable
  // to a line: "편한집밥" down the screen was harder to read, not easier.
  // Two or three syllables fill the width; longer names keep four across.
  // By the longest word: "루나아시아" stays whole on one line; a name of
  // several words breaks between them. A word of seven or more goes on
  // two even lines (4 + 3), not six and a stray syllable.
  const nameLen = Math.min(Math.max(...(koreanName(restaurant?.name ?? '') || '').split(/\s+/).map(w => { const n = [...w].length; return n > 6 ? Math.ceil(n / 2) : n; }), 2), 6);
  const nameMax = () => Math.min(200, Math.floor((window.innerWidth - 48) / nameLen));
  useFitText(nameLargeText, nameLarge, { min: 34, max: nameMax });
  const storyRef = useRef(null);
  // Opening another place from this one ("Also nearby", a journey's next
  // stop) reuses this sheet: start the new place at its top, not wherever
  // the last one was scrolled to.
  const scrollRef = useRef(null);
  // …unless it is come back to (Back from "Also nearby", from the cards):
  // then where it was being read, three screens down, not its top again.
  const navigationType = useNavigationType();
  // Read through a ref by the effects that must not re-run when it changes.
  const navType = useRef(navigationType);
  navType.current = navigationType;
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return undefined;
    const id = restaurant?.id;
    sc.scrollTop = navigationType === 'POP' ? (scrollMemory.get(id) ?? 0) : 0;
    const keep = () => { scrollMemory.set(id, sc.scrollTop); };
    sc.addEventListener('scroll', keep, { passive: true });
    // Also at the tap that leaves: a scroll event can still be pending when
    // a link is pressed right after a flick.
    sc.addEventListener('click', keep, true);
    return () => { sc.removeEventListener('scroll', keep); sc.removeEventListener('click', keep, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);
  const directionsRef = useRef(null);
  const sheetRef = useRef(null);
  // The pull-down-to-close gesture in progress (see onPullStart).
  const pull = useRef(null);
  // The bundle carries a lighter record; the full one (evidence, menus,
  // transit, phone, links) is fetched when the detail opens.
  const { full, failed: fullFailed, retry: retryFull } = usePlaceRecord(restaurant);
  // The menu, transit and phone arrive after the page is up and are put in
  // above the directions: on a slow link the reader has scrolled by then,
  // and the button under the thumb moved a quarter of a screen. The first
  // thing in view is noted (as the page scrolls and after every render),
  // and when the details land the scroll moves by as much as it moved.
  // The first thing, not the middle one: what grows below the top of the
  // view — an open "Why?" being filled in — must not push its own start
  // out of sight.
  const anchor = useRef(null);
  const hadFull = useRef(false);
  const noteAnchor = () => {
    const sc = scrollRef.current;
    if (!sc) return;
    const top = sc.getBoundingClientRect().top;
    let el = null;
    if (sc.scrollTop > 0) {
      // An open "Why?" lying across the top of the view is what is being
      // read: it holds. Otherwise the first thing that STARTS in view — a
      // line half out of sight above stayed put while the late rows went
      // in right under it and pushed the buttons down.
      const open = sc.querySelector('.claim-explain:not([hidden])');
      const o = open?.getBoundingClientRect();
      if (o && o.top < top && o.bottom > top + 40) el = open;
      else {
        el = [...sc.querySelectorAll('.detail-content > *, .detail-content > * > *')].find((c) => {
          const r = c.getBoundingClientRect();
          // Not the loading line, which goes when the details come.
          return r.height > 0 && r.top >= top && !c.closest('.detail-loading');
        }) ?? null;
      }
    }
    // From the scroller's own top, not the screen's: the sheet is still
    // sliding up when the first of these is taken.
    anchor.current = el ? { el, top: el.getBoundingClientRect().top - top } : null;
  };
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return undefined;
    sc.addEventListener('scroll', noteAnchor, { passive: true });
    return () => { sc.removeEventListener('scroll', noteAnchor); anchor.current = null; };
    // Per place: the sheet (and its scroller) is only there while one is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);
  // After every render: move once, in the render that brought the details;
  // then measure again, so the note is never older than the layout.
  useLayoutEffect(() => {
    const sc = scrollRef.current;
    const a = anchor.current;
    if (sc && full && !hadFull.current && a?.el.isConnected) {
      const moved = a.el.getBoundingClientRect().top - sc.getBoundingClientRect().top - a.top;
      if (Math.abs(moved) > 1) sc.scrollTop += moved;
    }
    hadFull.current = Boolean(full);
    noteAnchor();
  });
  // The place whose details have failed to load at least once: from then on
  // the retry button stays (dimmed while asking), so focus is not lost when
  // the app asks again by itself.
  const [retriedFor, setRetriedFor] = useState(null);
  const retryPressed = useRef(false);
  const placeId = restaurant?.id;
  useEffect(() => { setRetriedFor(null); retryPressed.current = false; }, [placeId]);
  // Half open (from a pin on a phone): as tall as the list it replaces, so
  // the strip of map above — and the pin in it — stays as it was. Scrolled
  // or pulled up, it becomes the full page.
  const [peekHeight, setPeekHeight] = useState(null);
  const expandRef = useRef(onExpand);
  expandRef.current = onExpand;
  useLayoutEffect(() => {
    if (!peek) return;
    const tall = window.innerHeight;
    const list = document.querySelector('.sidebar-region.sheet-state-1')?.getBoundingClientRect();
    const strip = Math.max(170, Math.min(tall * 0.45, list ? list.top : tall * 0.36));
    setPeekHeight(Math.round(tall - strip));
  }, [peek, placeId]);
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc || !peek) return undefined;
    const scrolled = () => { if (sc.scrollTop > 4) expandRef.current?.(); };
    const wheel = (e) => { if (e.deltaY > 0) expandRef.current?.(); };
    sc.addEventListener('scroll', scrolled, { passive: true });
    sc.addEventListener('wheel', wheel, { passive: true });
    return () => { sc.removeEventListener('scroll', scrolled); sc.removeEventListener('wheel', wheel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peek, placeId]);
  useEffect(() => { if (fullFailed) { setRetriedFor(placeId); retryPressed.current = false; } }, [fullFailed, placeId]);
  // Loaded after a press on Try again: the line and its button go, and
  // focus goes to the sheet rather than nowhere.
  useEffect(() => {
    if (full && retryPressed.current) {
      retryPressed.current = false;
      document.querySelector('.detail-sheet')?.focus({ preventScroll: true });
    }
  }, [full]);

  // Remember what opened the sheet (a card, a pin, a journey stop) and give
  // focus back to it on close, so a keyboard or screen-reader user resumes
  // where they were instead of at the top of the page. Declared before the
  // effect below, which moves focus into the sheet.
  useEffect(() => {
    if (!placeId) return undefined;
    const opener = document.activeElement;
    return () => {
      if (opener && opener !== document.body && document.contains(opener) && typeof opener.focus === 'function') {
        opener.focus({ preventScroll: true });
      } else {
        // The opener can be gone (the list re-sorted while the detail was
        // open beside the map); land on the list, not the page body.
        (document.getElementById('place-list') ?? document.querySelector('.journey-stop'))?.focus({ preventScroll: true });
      }
    };
  }, [placeId]);

  // The tab title names the open place, as the prerendered page for the
  // same URL does; bookmarks and history read it.
  const placeName = restaurant ? displayName(restaurant.name) : null;
  useEffect(() => {
    if (!placeName) return undefined;
    // Opened by a shared link, the page already carried this title; closing
    // then returns to the app's own.
    const own = `${placeName} · K-Food Map`;
    const before = document.title === own ? 'K-Food Map' : document.title;
    document.title = own;
    return () => { document.title = before; };
  }, [placeName]);

  useEffect(() => {
    setCopied(false);
    setKoAddrCopied(false);
    setShared(false);
    setOpenClaim(null);
    if (!restaurant) return;
    // Come back to (Back from another place): where it was being read,
    // not the section the first visit asked for.
    const cameBack = navType.current === 'POP' && scrollMemory.has(restaurant.id);
    if (cameBack) {
      sheetRef.current?.focus({ preventScroll: true });
    } else if (focusStory && storyRef.current) {
      storyRef.current.scrollIntoView({ block: 'start' });
    } else if (focusDirections && directionsRef.current) {
      directionsRef.current.scrollIntoView({ block: 'start' });
      directionsRef.current.querySelector('.detail-directions a')?.focus({ preventScroll: true });
    } else {
      sheetRef.current?.focus();
    }
  }, [restaurant, focusStory, focusDirections]);

  useEffect(() => {
    if (!restaurant) return undefined;
    const onKey = (e) => { 
      if (e.key === 'Escape') {
        // A confirmation is on top: Escape answers it, not this page.
        if (document.querySelector('.confirm-overlay')) return;
        if (nameLarge) {
          // The large Korean name is on top: Escape closes it, not the place.
          e.stopPropagation();
          closeNameLarge();
        } else if (galleryOpen) {
          e.stopPropagation();
          setGalleryOpen(false);
        } else {
          onClose(); 
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [restaurant, onClose, galleryOpen, nameLarge]);

  if (!restaurant) return null;

  const place = full ?? restaurant;

  const name = displayName(place.name);
  const status = getOpenStatus(place.hours);
  const today = todaysHours(place.hours);
  const week = weekHours(place.hours);
  const planStatus = planDate && planAt ? getOpenStatus(place.hours, planDate, { nameDay: true }) : null;
  const planWhen = planAt ? t('filters.dayTime', { day: t(`hours.day.${DAY_KEYS[planAt.day]}`), time: formatClock(planAt.minutes) }) : '';
  const culture = getCulture(place);
  const coords = coordsOf(place);
  const koName = koreanName(place.name);
  const copyKoName = async () => {
    // If it cannot be copied the name is still on screen to read out.
    if (await copyText(koName)) {
      setNameCopied(true);
      setTimeout(() => setNameCopied(false), 2000);
    }
  };
  // Past 50 km, a distance from the map centre is noise (a shared link
  // opens the map over Seoul), so it is not shown.
  // From the visitor once "My location" has answered (any distance: "320
  // km from you" is true and useful); otherwise from the map centre.
  const km = userLocation
    ? haversineKm(userLocation.lat, userLocation.lng, coords.lat, coords.lng)
    : mapCenter ? haversineKm(mapCenter[0], mapCenter[1], coords.lat, coords.lng) : null;
  const distance = km != null && (userLocation || km <= 50) ? formatDistance(km) : null;

  // Pork-free is not halal, so it never carries the crescent.
  const dietFacts = dietaryBadges(place).map(b => ({
    id: b.key,
    Icon: b.key === 'halal' && b.fact.value === HALAL.PORK_FREE ? null : DIETARY_ICON[b.key],
    label: b.label,
    fact: b.fact,
  }));
  // A known "no" (serves pork, no vegan dishes) is a claim like any other:
  // same mark, and tappable for its source. No diet icon — a crescent beside
  // "Not halal" reads as halal at a glance.
  const shownDiets = new Set(dietFacts.map(f => f.id));
  const noneFacts = ['vegan', 'halal'].filter(k => !shownDiets.has(k)).flatMap(k => {
    const f = place.dietary[k];
    return isKnown(f) && f.value === (k === 'vegan' ? VEGAN.NONE : HALAL.NONE)
      ? [{ id: k, Icon: null, label: t(`dietary.${k}None`), fact: f }]
      : [];
  });
  const claimFacts = [...dietFacts, ...noneFacts];
  const traitFacts = place.traits.filter(id => TRAIT_META[id])
    .map(id => ({ id, Icon: TRAIT_META[id].Icon, label: t(TRAIT_META[id].labelKey), fact: null }));
  const certClaim = place.dietary.halalCertClaim;
  const caveatKeys = DIET_CAVEAT_KEYS[dietaryConfidence(place)] ?? DIET_CAVEAT_KEYS[CONFIDENCE.UNKNOWN];
  const caveat = { title: t(caveatKeys.titleKey), body: t(caveatKeys.bodyKey) };
  const lastChecked = [
    place.coordinates, place.address, place.hours, place.menus,
    place.phone, place.officialUrl, place.instagram, place.transit,
    place.dietary.vegan, place.dietary.halal,
  ].map(f => f?.lastCheckedAt).filter(Boolean).sort().at(-1);

  // Only real photography opens the gallery: blowing the placeholder
  // illustration up to full screen shows nothing new.
  const galleryImages = [place.photo || place.coverImage].filter(Boolean);

  // The address as it is written in Korea (data/address-ko.js): what the
  // Korean map apps find and a taxi driver reads. In the Korean interface
  // it is the address; in the others it has a row of its own.
  const koAddr = koAddress(place);
  const koUi = i18n.language === 'ko';
  const shownAddress = koUi && koAddr ? koAddr : place.address.value;
  const handleCopy = async () => {
    if (await copyText(shownAddress)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  const copyKoAddr = async () => {
    if (await copyText(koAddr)) {
      setKoAddrCopied(true);
      setTimeout(() => setKoAddrCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    // The place, not the sharer's own search and chips (the fragment).
    const url = window.location.origin + window.location.pathname;
    // The claims as the page states them, with how sure each is — the
    // place's own line can say more ("a halal kitchen") than the record does.
    const claims = dietaryBadges(place).map(b => `${b.label} (${trustBadge(b.fact).label})`).join(' · ');
    const how = await shareOrCopy({ title: place.name, text: [place.name, claims, placeArea(place)].filter(Boolean).join(' — '), url });
    if (how === 'failed') { window.prompt(t('detail.share'), url); return; }
    if (how === 'dismissed') return;
    setShared(how);
    setTimeout(() => setShared(false), 2500);
  };

  // A phone's sheet is pulled down to put it away, as every other sheet on
  // the phone is. Only from the top of the page (further down, a downward
  // drag is scrolling back up) and only for a mostly vertical move. The
  // sheet follows the finger; let go past 110 px and it closes, short of
  // that it springs back. The X and Back still work.
  const onPullStart = (e) => {
    // Not from an overlay drawn over the sheet (the large Korean name is a
    // portal, but its touches still bubble here through React), not with a
    // second finger, and only from the top of the page.
    const el = sheetRef.current;
    if (pull.current?.on && el) { el.style.transform = ''; el.style.transition = ''; }
    if (docked || nameLarge || galleryOpen || !el?.contains(e.target) || e.touches.length !== 1 || (scrollRef.current?.scrollTop ?? 0) > 0) { pull.current = null; return; }
    pull.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dy: 0, on: false };
  };
  const onPullMove = (e) => {
    const p = pull.current;
    const el = sheetRef.current;
    if (!p || !el) return;
    if (e.touches.length !== 1) {
      // A second finger: let go of the sheet rather than leave it half down.
      if (p.on) { el.style.transform = ''; el.style.transition = ''; }
      pull.current = null;
      return;
    }
    const dx = e.touches[0].clientX - p.x;
    const dy = e.touches[0].clientY - p.y;
    if (!p.on) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      // Half open, an upward pull opens the full page.
      if (peek && dy < 0 && Math.abs(dx) < -dy) { pull.current = null; onExpand?.(); return; }
      if (dy <= 0 || Math.abs(dx) > dy || (scrollRef.current?.scrollTop ?? 0) > 0) { pull.current = null; return; }
      p.on = true;
      el.style.transition = 'none';
    }
    p.dy = Math.max(0, dy);
    el.style.transform = `translateY(${p.dy}px)`;
  };
  const onPullEnd = () => {
    const p = pull.current;
    const el = sheetRef.current;
    pull.current = null;
    if (!p || !p.on || !el) return;
    el.style.transition = 'transform 0.2s ease-out';
    if (p.dy > 110) {
      el.style.transform = 'translateY(100%)';
      setTimeout(() => { el.style.transform = ''; el.style.transition = ''; onClose(); }, 160);
    } else {
      el.style.transform = '';
    }
  };

  return (
    <>
      {/* Docked (768px up) the detail sits beside a live map: no backdrop,
          not modal. On a phone it is a modal sheet over the map. */}
      {!docked && !peek && <div className="detail-backdrop" onClick={onClose} />}
      <div
        className={`detail-sheet${docked ? ' detail-sheet--docked' : ''}${docked && belowSearch ? ' detail-sheet--below-search' : ''}${peek && !docked ? ' detail-sheet--peek' : ''}`}
        style={peek && !docked && peekHeight ? { '--peek-h': `${peekHeight}px` } : undefined}
        role="dialog"
        aria-modal={docked || peek ? undefined : 'true'}
        aria-label={name}
        ref={sheetRef}
        tabIndex={-1}
        onTouchStart={onPullStart}
        onTouchMove={onPullMove}
        onTouchEnd={onPullEnd}
        onTouchCancel={onPullEnd}
      >
        {/* The bar that says the sheet can be pulled down (phones only). */}
        {!docked && <span className="detail-grabber" aria-hidden="true" />}
        {/* Half open: the bar at the top is also a button for the full page. */}
        {!docked && peek && <button type="button" className="detail-expand" aria-label={t('map.expandPlace')} onClick={() => onExpand?.()} />}
        <button className="detail-close" aria-label={t('detail.close')} onClick={onClose}>
          <XIcon size={18} />
        </button>

        <div className="detail-scroll" ref={scrollRef}>
          {/* 1. Hero image — only when there is a photo. No place has one yet,
              and a placeholder band pushed the decision facts down. */}
          {galleryImages.length > 0 && (
            <PlaceImage place={place} variant="hero" onClick={() => setGalleryOpen(true)} />
          )}

          <div className={`detail-content${galleryImages.length > 0 ? '' : ' detail-content--no-hero'}`}>
            {/* 2. Restaurant Name */}
            {/* Opened from a food journey: which stop this is, and the way to
                the one before and after — the journey could be read but not
                followed (walkthrough 2). Above the name, where a "back to
                the list" would sit. */}
            {journey && (
              <nav className="journey-nav" aria-label={t('detail.journeyNavLabel')}>
                <p className="journey-nav__where">
                  <span className="journey-nav__position">{t('detail.journeyPosition', { index: journey.index + 1, total: journey.total })}</span>
                  <span className="journey-nav__title"> · {journey.title}</span>
                </p>
                <div className="journey-nav__buttons">
                  {journey.prev && (
                    <button
                      type="button"
                      className="journey-nav__btn journey-nav__btn--prev"
                      aria-label={`${t('detail.journeyPrev', { index: journey.index })}: ${displayName(journey.prev.name)}`}
                      onClick={() => onJourneyStop(journey.prev, journey.index - 1)}
                    >
                      <ChevronLeftIcon size={16} />
                      <span>{t('detail.journeyPrev', { index: journey.index })}</span>
                    </button>
                  )}
                  {journey.next ? (
                    <button type="button" className="journey-nav__btn journey-nav__btn--next" onClick={() => onJourneyStop(journey.next, journey.index + 1)}>
                      <span className="journey-nav__next-text">
                        <span className="journey-nav__next-label">{t('detail.journeyNext')}: {displayName(journey.next.name)}</span>
                        <span className="journey-nav__next-km">{t('detail.journeyNextKm', { distance: formatDistance(journey.nextKm) })}</span>
                      </span>
                      <ChevronRightIcon size={16} />
                    </button>
                  ) : (
                    <span className="journey-nav__end">{t('detail.journeyLast')}</span>
                  )}
                </div>
              </nav>
            )}
            <header className="detail-header">
              {/* A Korean reader gets the Korean name here too, as on the list
                  and in the Journal. */}
              <h2>{i18n.language === 'ko' ? displayName(place.name) : <KoText>{place.name}</KoText>}</h2>
              <p className="detail-meta">
                {placeArea(place)}
                {/* Only a distance from the reader: one from the map's centre means
                    nothing on the place's own page. */}
                {distance && userLocation && <><span aria-hidden="true"> · </span>{t('detail.fromYou', { distance })}</>}
                {/* Open/closed up here too, as on the list card: it is the first thing
                    a traveller acts on. The detail stays in the hours row below. */}
                {status && (
                  <><span aria-hidden="true"> · </span><strong className={statusClass(status)}>{status.label}</strong></>
                )}
              </p>
            </header>

            {/* 3. Diet Tags */}
            {claimFacts.length > 0 && (
              <ul className="fact-row" aria-label={t('detail.dietaryFactsLabel')}>
                {claimFacts.map(({ id, Icon, label, fact: f }) => (
                  <ClaimFact
                    key={id}
                    id={id}
                    Icon={Icon}
                    label={label}
                    fact={f}
                    open={openClaim === id}
                    onToggle={() => setOpenClaim(o => (o === id ? null : id))}
                  />
                ))}
              </ul>
            )}
            {/* The diet this place has no claim for is said, not left out
                (docs/UI-DIRECTION.md, P2): a Muslim visitor reading a vegan
                café should see "Halal · Not known", not silence. A known
                "no" (serves pork) is a claim with its own strength. */}
            {(() => {
              const claimed = new Set(claimFacts.map(f => f.id));
              // One plain phrase: a bold "Halal" beside a small "Not known" read as yes.
              const unknown = ['vegan', 'halal'].filter(k => !claimed.has(k))
                .map(k => <ClaimChip key={k} level={t(`dietary.${k}NotKnown`)} tone="none" />);
              return unknown.length > 0 && <p className="detail-otherdiet">{unknown}</p>;
            })()}
            {/* Traits describe the place; they are not claims with a
                confidence, so they are plain text, not chips. */}
            {traitFacts.length > 0 && (
              <p className="detail-traits">
                {traitFacts.map(({ id, Icon, label }, i) => (
                  <span key={id}>
                    {i > 0 && <span aria-hidden="true"> · </span>}
                    <Icon size={14} aria-hidden="true" /> {label}
                  </span>
                ))}
              </p>
            )}
            {claimFacts.map(({ id, label, fact: f }) => {
              const { label: level, detail } = trustBadge(f);
              return (
                <div key={id} id={`claim-explain-${id}`} className="claim-explain" hidden={openClaim !== id}>
                  {/* The research note can run to two screens: the first
                      lines, and the rest on request. */}
                  <p className={`claim-explain__text${detail.length > 420 && !claimFull ? ' is-clamped' : ''}`}><strong>{label} · {level}</strong> — {noteWithLinks(plainNote(detail))}</p>
                  {detail.length > 420 && (
                    <button type="button" className="claim-explain__more" aria-expanded={claimFull} onClick={() => setClaimFull(v => !v)}>
                      {t(claimFull ? 'detail.claimLess' : 'detail.claimMore')}
                    </button>
                  )}
                  {/* What the halal label leaves out, said in the reader's
                      language: the note above is in English, and "alcohol
                      may be sold" was its last line when it was there at all. */}
                  {id === 'halal' && <p className="claim-explain__meta">{t('detail.halalAlcohol')}</p>}
                  <p className="claim-explain__meta">
                    {t('detail.claimSource', { source: sourceWithSite(f) })}
                    {f.lastCheckedAt && <> · {t('detail.claimChecked', { date: formatLongDate(f.lastCheckedAt, i18n.language) })}</>}
                  </p>
                </div>
              );
            })}

            {(
            <div className="diet-note">
              {/* An open claim explanation already says this, with its source. */}
              {openClaim === null && <p><strong>{caveat.title}</strong> {caveat.body}</p>}
              {/* "Ask staff" needs a way to ask: the Korean cards, on the
                  card that fits this place's claims. */}
              {(
                <Link
                  className="diet-note__ask"
                  to={`/cards?card=${cardForPlace(place)}`}
                  state={{ fromApp: true, tab: location.state?.tab }}
                >
                  {t('detail.askInKorean')}
                </Link>
              )}
              {certClaim && (
                <p className="diet-note__cert">
                  {certClaim.note
                    ? t('detail.certificationClaimedNote', { body: certClaim.body, note: certClaim.note })
                    : t('detail.certificationClaimed', { body: certClaim.body })}
                </p>
              )}
            </div>
            )}

            {/* 4. Quick Information (Hours, Transit, Links, Actions) */}
            <div className="practical">
              <div className="practical-row">
                <ClockIcon size={17} />
                {status ? (
                  <span>
                    <strong className={statusClass(status)}>{status.label}</strong>
                    {status.detail && <>{' '}· {status.detail}</>}{' '}
                    {today && (() => {
                      // The sentence around the hours, and the hours in pieces that
                      // do not break inside a time ("6:00 PM – / 8:20 PM", "午 / 後8:20").
                      const [before, after = ''] = t('detail.todayHours', { hours: '\u0000' }).split('\u0000');
                      return <span className="practical-muted practical-today">{before}{hoursPieces(today)}{after}</span>;
                    })()}
                    {/* A device on another clock (planning from abroad): say
                        whose time this is, and what time it is there. */}
                    {!deviceOnKoreaTime() && <span className="practical-muted practical-today">{t('detail.koreaTime', { time: koreaClock() })}</span>}
                  </span>
                ) : (
                  <span className="practical-muted">{t('detail.hoursUnknown')}</span>
                )}
              </div>
              {/* With "Open at…" on, the list answered for that time; this
                  page's line above is about now. Say both, each labelled. */}
              {planStatus && (
                <div className="practical-row practical-row--plan">
                  <span aria-hidden="true" style={{ width: 17 }} />
                  <span>
                    <span className="practical-muted">{planWhen}: </span>
                    <strong className={statusClass(planStatus)}>{planStatus.label}</strong>
                    {planStatus.detail && <> · {planStatus.detail}</>}
                  </span>
                </div>
              )}
              {/* The whole week, for planning tomorrow or the weekend. A day
                  the record does not cover is said to be not recorded. */}
              {week && (
                <details className="week-hours" onToggle={(e) => { if (e.currentTarget.open) e.currentTarget.scrollIntoView({ block: 'nearest' }); }}>
                  <summary>{t('detail.weekHours')}</summary>
                  <dl>
                    {week.map(d => (
                      <div key={d.key} className={d.today ? 'is-today' : undefined}>
                        <dt>{d.day}{d.today && <span className="visually-hidden"> ({t('filters.today')})</span>}</dt>
                        {/* Lunch and dinner each on a line of their own: run together
                            they wrapped mid-time on a phone. */}
                        <dd>{d.text ? d.text.split(', ').map(part => <span key={part} className="week-hours__slot">{hoursPieces(part)}</span>) : t('detail.notRecorded')}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
              {/* Hours are what goes out of date first: the way to say so is
                  here, not only three screens down. */}
              {week && (
                <Link className="detail-report detail-report--hours" to={`/submit?place=${place.id}`} state={{ fromApp: true, tab: location.state?.tab, topic: 'hours' }}>
                  {t('submit.reportLink')}
                </Link>
              )}

              {isKnown(place.transit) && (
                <div className="practical-row">
                  <TrainIcon size={17} />
                  <span>
                    {koUi && koStation(place.transit.value.station) && koLine(place.transit.value.line)
                      ? <span lang="ko">{koStation(place.transit.value.station)} {koLine(place.transit.value.line)}</span>
                      : <>{place.transit.value.station} {place.transit.value.line}</>}
                    {place.transit.value.exit && t('detail.transitExit', { exit: place.transit.value.exit })}
                    {t('detail.transitWalk', { minutes: place.transit.value.walkingMinutes })}
                    {/* Past a quarter of an hour the "nearest station" is not
                        near; say so rather than imply it. */}
                    {place.transit.value.walkingMinutes > 15 && t('detail.transitFar')}
                  </span>
                </div>
              )}

              {isKnown(place.phone) && (
                <div className="practical-row">
                  <PhoneIcon size={17} />
                  <a className="practical-link practical-link--call" href={`tel:${telHref(place.phone.value)}`}>
                    {t('detail.call')} {place.phone.value}
                  </a>
                </div>
              )}

              {(isKnown(place.officialUrl) || isKnown(place.instagram)) && (
                <div className="practical-row">
                  <LinkIcon size={17} />
                  <span className="practical-links">
                    {isKnown(place.officialUrl) && (
                      <a className="practical-link" href={place.officialUrl.value} target="_blank" rel="noreferrer noopener">{t('detail.website')}</a>
                    )}
                    {isKnown(place.instagram) && (
                      <a className="practical-link" href={place.instagram.value} target="_blank" rel="noreferrer noopener">{t('detail.instagram')}</a>
                    )}
                  </span>
                </div>
              )}

              {/* Worded, not icon-only, and no checkmark: a check under the
                  dietary claims read as "verified". A visit is a seal, as the
                  Journal stamps it. Toggles say their state with aria-pressed. */}
              <div className="practical-actions">
                <button
                  type="button"
                  className={`action-btn${isBookmarked ? ' action-btn--saved' : ''}`}
                  aria-pressed={isBookmarked}
                  onClick={() => onToggleBookmark(place.id)}
                >
                  <HeartIcon size={20} filled={isBookmarked} />
                  <span>{isBookmarked ? t('detail.actionSaved') : t('detail.actionSave')}</span>
                </button>
                <button
                  type="button"
                  className={`action-btn${isVisited ? ' action-btn--visited' : ''}`}
                  aria-pressed={isVisited}
                  onClick={() => onToggleVisited(place.id)}
                >
                  <SealIcon size={20} />
                  <span>{t('detail.actionBeenHere')}</span>
                </button>
                <button type="button" className="action-btn" onClick={handleShare}>
                  <ShareIcon size={20} />
                  <span>{shared === 'copied' ? t('journal.listCopied') : shared ? t('detail.shared') : t('detail.share')}</span>
                </button>
              </div>
              {/* What a save or a visit did is said by the app's toast (with
                  Undo): a second copy here said it twice, and went on saying
                  "Saved" after "Been here" had been pressed. */}
            </div>

            {/* Menus, transit, phone and links arrive with the full record
                (usePlaceRecord). Say so while it loads, so the sheet doesn't
                look finished and then grow; offline the line never shows. Below the
                actions, so Save / Been here don't jump when it goes. */}
            {/* One status line that changes its words (a status inserted
                together with its text is not read out), and the button beside
                it rather than inside, so pressing it does not unmount it. */}
            {!full && (isOnline || fullFailed) && typeof navigator !== 'undefined' && navigator.onLine !== false && (
              <div className="detail-loading">
                <span role="status">{fullFailed ? t('detail.loadFailed') : t('detail.loadingDetails')}</span>{' '}
                {/* Once pressed it stays (dimmed while asking): hidden, it took the
                    focus away with it. */}
                <button type="button" className="detail-loading__retry" hidden={!fullFailed && retriedFor !== place.id} aria-disabled={!fullFailed}
                  onClick={() => { if (!fullFailed) return; retryPressed.current = true; retryFull(); }}>{t('detail.loadRetry')}</button>
              </div>
            )}

            {/* The menu before the way there: what is served and what it costs
                decides whether to go, and it sat three screens down, under
                "Also nearby". The directions are in the bar at the bottom. */}
            {/* 6. Representative Menu */}
            {isKnown(place.menus) && (
              <section className="detail-section">
                <SectionHead Icon={MenuIcon} title={t('detail.signatureMenu')} />
                <div className="menu-rows">
                  {place.menus.value.map(m => (
                    <div key={m.name} className="menu-row">
                      <span><KoText>{m.name}</KoText></span>
                      <span className="menu-row__price">{formatPrice(m.price) ?? t('detail.priceNotListed')}</span>
                    </div>
                  ))}
                </div>
                {/* A pork dish listed under "Vegan options" read as a
                    contradiction (critique 3); the menu is the restaurant's
                    own, so say what it is rather than filter it. */}
                {isKnown(place.dietary.vegan) && place.dietary.vegan.value === VEGAN.OPTIONS && (
                  <p className="section-note">{t('detail.menuNotAllVegan')}</p>
                )}
                {needsCheck(place.menus) && (
                  <p className="section-note">{t('detail.menuUnverified')}</p>
                )}
              </section>
            )}

            {/* 5. Directions / Address. Naver and Kakao first: they are the maps
                visitors are told to use in Korea, where Google's coverage is thin. */}
            <section className="detail-section" ref={directionsRef}>
              <SectionHead Icon={CompassIcon} title={t('detail.locationDirections')} />
              {/* Reached straight from a card's directions button, this section
                  is all that shows: it says whose directions these are, and
                  what the two Korean buttons are to someone from abroad. */}
              <p className="section-note detail-directions__for"><strong>{displayName(place.name)}</strong></p>
              <p className="section-note">{t('detail.mapAppsNote')}</p>
              
              {/* The map buttons before the address: on a 375x812 phone they
                  started just below the first screen (walkthrough 2). */}
              <div className="detail-directions">
                {/* Links, not buttons: they leave the app, and a link can be
                    long-pressed, copied or opened in a new tab. */}
                {!isOnline && <p className="practical-muted detail-offline-note">{t('detail.offlineLinks')}</p>}
                <a className="btn-primary btn-primary--naver" href={naverMapUrl(place)} target="_blank" rel="noopener noreferrer">
                  {t('detail.naverMap')}
                </a>
                <a className="btn-primary btn-primary--kakao" href={kakaoMapUrl(place)} target="_blank" rel="noopener noreferrer">
                  {t('detail.kakaoMap')}
                </a>
                <a className="btn-primary btn-primary--google" href={directionsUrl(place)} target="_blank" rel="noopener noreferrer">
                  Google Maps
                </a>
              </div>
              <div className="practical-row">
                <MapPinIcon size={17} />
                <span lang={shownAddress === koAddr ? 'ko' : undefined}>
                  {shownAddress}
                  {shownAddress !== place.address.value && (
                    <span className="practical-address-roman" lang="en">{place.address.value}</span>
                  )}
                  {place.address.precision === 'area' && (
                    <span className="practical-muted">{t('detail.areaOnly')}</span>
                  )}
                </span>
                <button className="practical-copy" aria-label={`${t('detail.copy')}: ${shownAddress}`} onClick={handleCopy}>
                  {copied ? t('detail.copied') : t('detail.copy')}
                </button>
              </div>
              {!koUi && koAddr && (
                <div className="practical-row ko-name">
                  <span className="ko-name__label">{t('detail.koreanAddress')}</span>
                  <span className="ko-name__value ko-name__value--address" lang="ko">{koAddr}</span>
                  <button type="button" className="practical-copy" aria-label={`${t('detail.copy')}: ${koAddr}`} onClick={copyKoAddr}>
                    {koAddrCopied ? t('detail.copied') : t('detail.copy')}
                  </button>
                </div>
              )}
              {/* The name as the sign, the Korean map apps and a taxi driver
                  have it. Records without a Korean name show nothing here. */}
              {koName && (
                <div className="practical-row ko-name">
                  <span className="ko-name__label">{t('detail.koreanName')}</span>
                  <span className="ko-name__value" lang="ko">{koName}</span>
                  <button type="button" className="practical-copy" aria-label={`${t('detail.copy')}: ${koName}`} onClick={copyKoName}>
                    {nameCopied ? t('detail.copied') : t('detail.copy')}
                  </button>
                  <button type="button" className="practical-copy" ref={nameLargeBtn} aria-haspopup="dialog" onClick={() => setNameLarge(true)}>
                    {t('detail.showLarge')}
                  </button>
                  {/* On the body, not inside the sheet: the sheet is
                      transformed on wide screens, which would trap a
                      fixed-position overlay inside it. */}
                  {nameLarge && createPortal(
                    // No aria-label: it would replace the Korean a screen
                    // reader should read out; the visible hint names the action.
                    <button type="button" className="staff-large" autoFocus onClick={closeNameLarge} onKeyDown={(e) => { if (e.key === 'Tab') e.preventDefault(); }}>
                      <span className="staff-large__text staff-large__text--name" lang="ko" ref={nameLargeText}><span>{koName}</span></span>
                      {/* What a driver or a passer-by can use besides the
                          name: the number to ring for the way. */}
                      {koAddr && <span className="staff-large__sub staff-large__sub--address" lang="ko">{koAddr}</span>}
                      {isKnown(place.phone) && <span className="staff-large__sub">{place.phone.value}</span>}
                      <span className="staff-large__close">{t('detail.tapToClose')}</span>
                    </button>,
                    document.body,
                  )}
                </div>
              )}
              <Link className="detail-report" to={`/submit?place=${place.id}`} state={{ fromApp: true, tab: location.state?.tab }}>
                {t('submit.reportLink')}
              </Link>
            </section>

            {/* Other places within a short walk: if this one is shut or
                full, the next option is one tap away. Nearest first; the
                distance is a straight line and says so. */}
            {nearby.length > 0 && (
              <section className="detail-section">
                <SectionHead Icon={MapPinIcon} title={t('detail.nearbyTitle')} />
                {nearbyDiet.length > 0 && (
                  <p className="practical-muted nearby-filtered">{t('detail.nearbyFiltered')}</p>
                )}
                <ul className="saved-list">
                  {nearby.map(({ place: other, km }) => {
                    // With "Open at…" on, the row answers for that time, as
                    // the list did: "Open" for now sent a Monday plan to a
                    // place shut on Mondays.
                    const otherStatus = planDate && planAt
                      ? getOpenStatus(other.hours, planDate, { nameDay: true })
                      : getOpenStatus(other.hours);
                    return (
                      <li key={other.id}>
                        <button type="button" className="saved-row" onClick={() => onOpenPlace(other)}>
                          <span className="saved-row__main">
                            <span className="saved-row__name">{displayName(other.name)}</span>
                            <span className="saved-row__where">{t('detail.nearbyAway', { distance: formatDistance(km) })}</span>
                            {/* As on the list cards: no hours on record is
                                said, so a missing line is not read as open. */}
                            <span className="saved-row__status">
                              {otherStatus ? (
                                <>
                                  {planDate && planAt && <span className="place-card__at">{t(`hours.day.${DAY_KEYS[planAt.day]}`)}: </span>}
                                  <span className={statusClass(otherStatus)}>{otherStatus.label}</span>
                                  {otherStatus.detail && <> · {otherStatus.detail}</>}
                                </>
                              ) : (
                                <span className="place-card__unknown">{t('list.hoursUnknown')}</span>
                              )}
                            </span>
                            <span className="saved-row__claims">
                              {dietaryBadges(other).map(b => <ClaimChip key={b.key} kind={b.key} label={b.label} fact={b.fact} />)}
                            </span>
                          </span>
                          <ChevronRightIcon size={16} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            
            {/* 7. Story & Hook */}
            
            <section className="detail-section" ref={storyRef}>
              <SectionHead Icon={BookIcon} title={t('detail.foodStory')} kr="이야기" />
              {/* The UI is translated; a place's own text is not. Say so once,
                  where the English starts, and mark it for screen readers. */}
              {i18n.language !== 'en' && !stories?.[place.id]?.story && <p className="section-note">{t('detail.contentInEnglish')}</p>}
              {stories?.[place.id]?.story
                ? <p className="detail-body" lang={i18n.language}>{stories[place.id].story}</p>
                : <p className="detail-body" lang="en">{place.story}</p>}
              {place.timeline?.length > 0 && (
                <ol className="timeline">
                  {place.timeline.map(t => (
                    <li key={`${t.year}-${t.event}`} className="timeline__item">
                      <span className="timeline__year">{t.year}</span>
                      <span className="timeline__event">{t.event}</span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="callout">
                <p className="callout__label">{t('detail.didYouKnow')}</p>
                <p>{culture.didYouKnow}</p>
              </div>
            </section>

            {/* Dining Tips */}
            <section className="detail-section">
              <SectionHead Icon={BowlIcon} title={t('detail.diningTips')} />
              <ul className="tips-list">
                {culture.diningTips.map(tip => (
                  <li key={tip} className="tip">
                    <span className="tip__dot" aria-hidden="true" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Footer */}
            <footer className="provenance">
              <p className="provenance__title">{t('detail.aboutThisInformation')}</p>
              <p>
                <Trans i18nKey="detail.provenanceOfficialSentence" components={[<strong key="0" />]} />
                <Trans i18nKey="detail.provenanceReportedSentence" components={[<strong key="0" />]} /> <Trans i18nKey="detail.provenanceInferredSentence" components={[<strong key="0" />, <strong key="1" />]} />
              </p>
              <dl className="provenance__list">
                <div>
                  <dt>{t('detail.location')}</dt>
                  <dd>
                    {sourceLabel(place.coordinates.source)}
                    {place.address.precision === 'area' && t('detail.addressAreaLevel')}
                  </dd>
                </div>
                <div>
                  <dt>{t('detail.dietary')}</dt>
                  <dd>
                    {dietFacts.length > 0
                      ? [...new Set(dietFacts.map(f => sourceWithSite(f.fact)))].join(' · ')
                      : t('detail.notRecorded')}
                  </dd>
                </div>
                <div>
                  <dt>{t('detail.lastChecked')}</dt>
                  {/* Dates arrive with the full record; until then say nothing
                      rather than "Never". */}
                  <dd>{lastChecked ? formatLongDate(lastChecked, i18n.language) : full ? t('detail.never') : fullFailed ? '—' : '…'}</dd>
                </div>
              </dl>
            </footer>
            
            <div className="transparency-log">
              {/* The date is in the list above, as "last checked". A second line
                  calling it "last verified" overstated it: a check can end in
                  "unknown". */}
              <p>{t('detail.suggestEdit', { link: t('submit.reportLink') })}</p>
            </div>

          </div>
        </div>

        {/* On a phone, the two things this page is opened for stay in reach
            of a thumb however far it has been scrolled: the way there (the
            two maps that work in Korea) and Save. The same links sit in the
            page with Google's; from 768 px the page is beside the map and
            needs no bar. */}
        {!docked && (
          <div className="detail-bar">
            {/* Close within the thumb's reach: the X is at the top of a tall
                phone, and Back is not on every screen. */}
            <button type="button" className="detail-bar__close" aria-label={t('detail.close')} onClick={onClose}>
              <XIcon size={20} />
            </button>
            <a className="detail-bar__map btn-primary--naver" href={naverMapUrl(place)} target="_blank" rel="noopener noreferrer">
              <CompassIcon size={18} />
              <span>{t('detail.naverMap')}</span>
            </a>
            <a className="detail-bar__map btn-primary--kakao" href={kakaoMapUrl(place)} target="_blank" rel="noopener noreferrer">
              <CompassIcon size={18} />
              <span>{t('detail.kakaoMap')}</span>
            </a>
            <button
              type="button"
              className={`detail-bar__save${isBookmarked ? ' is-saved' : ''}`}
              aria-pressed={isBookmarked}
              aria-label={t('detail.actionSave')}
              onClick={() => onToggleBookmark(place.id)}
            >
              <HeartIcon size={22} filled={isBookmarked} />
            </button>
          </div>
        )}
      </div>

      {galleryOpen && galleryImages.length > 0 && (
        <div className="gallery-overlay" onClick={() => setGalleryOpen(false)}>
          <button className="gallery-close" onClick={() => setGalleryOpen(false)}>
            <XIcon size={24} />
          </button>
          
          <div className="gallery-slider" onClick={e => e.stopPropagation()}>
            {galleryImages.map((img, i) => (
              <img key={i} src={img} className="gallery-slide" alt={t('detail.galleryItem')} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
