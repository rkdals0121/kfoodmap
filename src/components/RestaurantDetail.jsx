import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router';
import { useTranslation, Trans } from 'react-i18next';
import PlaceImage from './PlaceImage';
import {
  HeartIcon, CompassIcon, XIcon, ClockIcon, MapPinIcon, CrescentIcon,
  MildIcon, FermentIcon, SproutIcon, RecycleIcon, LeafIcon,
  BookIcon, BowlIcon, MenuIcon, TrainIcon, PhoneIcon, LinkIcon, SealIcon, ShareIcon, InfoIcon,
  ChevronLeftIcon, ChevronRightIcon,
} from './Icons';
import { getCulture } from '../data/culture';
import { haversineKm, formatDistance, getOpenStatus, todaysHours, directionsUrl, naverMapUrl, kakaoMapUrl, coordsOf, formatLongDate, displayName, deviceOnKoreaTime, koreaClock, koreanName, weekHours, statusClass } from '../utils';
import {
  dietaryBadges, isKnown, needsCheck, trustBadge, dietaryConfidence, CONFIDENCE, VEGAN, HALAL,
} from '../data/verification';
import { sourceLabel } from '../i18n/labels';
import usePlaceRecord from '../hooks/usePlaceRecord';
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
function ClaimFact({ id, Icon, label, fact, open, onToggle }) {
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
        <span className="claim-fact__why" aria-hidden="true"><InfoIcon size={14} /></span>
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

export default function RestaurantDetail({
  restaurant, onClose, isBookmarked, onToggleBookmark, isVisited, onToggleVisited, userLocation = null,
  journey = null, onJourneyStop, nearby = [], nearbyDiet = [], onOpenPlace,
  mapCenter, focusStory, focusDirections = false, docked = false, belowSearch = false,
}) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [openClaim, setOpenClaim] = useState(null);
  // The Korean name on the whole screen, to show a driver or a passer-by.
  const [nameLarge, setNameLarge] = useState(false);
  const [nameCopied, setNameCopied] = useState(false);
  const nameLargeBtn = useRef(null);
  // Closing gives focus back to the button that opened it.
  const closeNameLarge = () => { setNameLarge(false); nameLargeBtn.current?.focus(); };
  // Say where a save went. Driven by the saved state actually changing, not
  // the tap (unsaving a visited place can be cancelled), and only while the
  // same place stays open.
  const [saveNote, setSaveNote] = useState(null);
  const lastSaved = useRef({ id: restaurant?.id, saved: isBookmarked });
  useEffect(() => {
    const prev = lastSaved.current;
    lastSaved.current = { id: restaurant?.id, saved: isBookmarked };
    if (prev.id !== restaurant?.id) { setSaveNote(null); return undefined; }
    if (prev.saved === isBookmarked) return undefined;
    setSaveNote(isBookmarked ? 'saved' : 'removed');
    const timer = setTimeout(() => setSaveNote(null), 3000);
    return () => clearTimeout(timer);
  }, [isBookmarked, restaurant?.id]);
  const storyRef = useRef(null);
  // Opening another place from this one ("Also nearby", a journey's next
  // stop) reuses this sheet: start the new place at its top, not wherever
  // the last one was scrolled to.
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [restaurant?.id]);
  const directionsRef = useRef(null);
  const sheetRef = useRef(null);
  // The bundle carries a lighter record; the full one (evidence, menus,
  // transit, phone, links) is fetched when the detail opens.
  const full = usePlaceRecord(restaurant);

  // Remember what opened the sheet (a card, a pin, a journey stop) and give
  // focus back to it on close, so a keyboard or screen-reader user resumes
  // where they were instead of at the top of the page. Declared before the
  // effect below, which moves focus into the sheet.
  const placeId = restaurant?.id;
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
    const before = document.title === own ? 'K-Food Map · Vegan & Halal Food in Korea' : document.title;
    document.title = own;
    return () => { document.title = before; };
  }, [placeName]);

  useEffect(() => {
    setCopied(false);
    setShared(false);
    setOpenClaim(null);
    if (!restaurant) return;
    if (focusStory && storyRef.current) {
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
  const culture = getCulture(place);
  const coords = coordsOf(place);
  const koName = koreanName(place.name);
  const copyKoName = async () => {
    try {
      await navigator.clipboard.writeText(koName);
      setNameCopied(true);
      setTimeout(() => setNameCopied(false), 2000);
    } catch {
      // No async clipboard (an in-app browser, plain http): the same
      // fallback the address uses. If that fails too, the name is on screen.
      if (fallbackCopy(koName)) {
        setNameCopied(true);
        setTimeout(() => setNameCopied(false), 2000);
      }
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

  const fallbackCopy = (text) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  };

  const handleCopy = async () => {
    let ok = false;
    const address = place.address.value;
    try {
      await navigator.clipboard.writeText(address);
      ok = true;
    } catch {
      ok = fallbackCopy(address);
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    const shareText = `${place.name} — ${place.vibe}`;
    // The place, not the sharer's own search and chips (the fragment).
    const shareUrl = window.location.origin + window.location.pathname;
    if (navigator.share) {
      try {
        await navigator.share({ title: place.name, text: shareText, url: shareUrl });
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      } catch { }
    } else {
      const text = `${shareText}\n${shareUrl}`;
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch { ok = fallbackCopy(text); }
      if (ok) {
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      }
    }
  };

  return (
    <>
      {/* Docked (768px up) the detail sits beside a live map: no backdrop,
          not modal. On a phone it is a modal sheet over the map. */}
      {!docked && <div className="detail-backdrop" onClick={onClose} />}
      <div
        className={`detail-sheet${docked ? ' detail-sheet--docked' : ''}${docked && belowSearch ? ' detail-sheet--below-search' : ''}`}
        role="dialog"
        aria-modal={docked ? undefined : 'true'}
        aria-label={name}
        ref={sheetRef}
        tabIndex={-1}
      >
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
              <h2><KoText>{place.name}</KoText></h2>
              <p className="detail-meta">
                {place.zone}
                {distance && <><span aria-hidden="true"> · </span>{userLocation ? t('detail.fromYou', { distance }) : t('detail.fromMapCentre', { distance })}</>}
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
                  <p><strong>{label} · {level}</strong> — {detail}</p>
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
                    {today && <span className="practical-muted practical-today">{t('detail.todayHours', { hours: today })}</span>}
                    {/* A device on another clock (planning from abroad): say
                        whose time this is, and what time it is there. */}
                    {!deviceOnKoreaTime() && <span className="practical-muted practical-today">{t('detail.koreaTime', { time: koreaClock() })}</span>}
                  </span>
                ) : (
                  <span className="practical-muted">{t('detail.hoursUnknown')}</span>
                )}
              </div>
              {/* The whole week, for planning tomorrow or the weekend. A day
                  the record does not cover is said to be not recorded. */}
              {week && (
                <details className="week-hours">
                  <summary>{t('detail.weekHours')}</summary>
                  <dl>
                    {week.map(d => (
                      <div key={d.key} className={d.today ? 'is-today' : undefined}>
                        <dt>{d.day}</dt>
                        <dd>{d.text ?? t('detail.notRecorded')}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}

              {isKnown(place.transit) && (
                <div className="practical-row">
                  <TrainIcon size={17} />
                  <span>
                    {place.transit.value.station} {place.transit.value.line}
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
                  <a className="practical-link" href={`tel:${place.phone.value.replace(/-/g, '')}`}>
                    {place.phone.value}
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
                  <span>{shared ? t('detail.shared') : t('detail.share')}</span>
                </button>
              </div>
              <p className="action-note" role="status">
                {saveNote === 'saved' && t('detail.savedNote')}
                {saveNote === 'removed' && t('detail.removedNote')}
              </p>
            </div>

            {/* Menus, transit, phone and links arrive with the full record
                (usePlaceRecord). Say so while it loads, so the sheet doesn't
                look finished and then grow; offline the line never shows. Below the
                actions, so Save / Been here don't jump when it goes. */}
            {!full && typeof navigator !== 'undefined' && navigator.onLine !== false && (
              <p className="detail-loading" role="status">{t('detail.loadingDetails')}</p>
            )}

            {/* 5. Directions / Address. Naver and Kakao first: they are the maps
                visitors are told to use in Korea, where Google's coverage is thin. */}
            <section className="detail-section" ref={directionsRef}>
              <SectionHead Icon={CompassIcon} title={t('detail.locationDirections')} />
              
              {/* The map buttons before the address: on a 375x812 phone they
                  started just below the first screen (walkthrough 2). */}
              <div className="detail-directions">
                {/* Links, not buttons: they leave the app, and a link can be
                    long-pressed, copied or opened in a new tab. */}
                <a className="btn-primary btn-primary--naver" href={naverMapUrl(place)} target="_blank" rel="noopener noreferrer">
                  Naver Map
                </a>
                <a className="btn-primary btn-primary--kakao" href={kakaoMapUrl(place)} target="_blank" rel="noopener noreferrer">
                  Kakao Map
                </a>
                <a className="btn-primary btn-primary--google" href={directionsUrl(place)} target="_blank" rel="noopener noreferrer">
                  Google Maps
                </a>
              </div>
              <div className="practical-row">
                <MapPinIcon size={17} />
                <span>
                  {place.address.value}
                  {place.address.precision === 'area' && (
                    <span className="practical-muted">{t('detail.areaOnly')}</span>
                  )}
                </span>
                <button className="practical-copy" onClick={handleCopy}>
                  {copied ? t('detail.copied') : t('detail.copy')}
                </button>
              </div>
              {/* The name as the sign, the Korean map apps and a taxi driver
                  have it. Records without a Korean name show nothing here. */}
              {koName && (
                <div className="practical-row ko-name">
                  <span className="ko-name__label">{t('detail.koreanName')}</span>
                  <span className="ko-name__value" lang="ko">{koName}</span>
                  <button type="button" className="practical-copy" onClick={copyKoName}>
                    {nameCopied ? t('detail.copied') : t('detail.copy')}
                  </button>
                  <button type="button" className="practical-copy" ref={nameLargeBtn} onClick={() => setNameLarge(true)}>
                    {t('detail.showLarge')}
                  </button>
                  {/* On the body, not inside the sheet: the sheet is
                      transformed on wide screens, which would trap a
                      fixed-position overlay inside it. */}
                  {nameLarge && createPortal(
                    // No aria-label: it would replace the Korean a screen
                    // reader should read out; the visible hint names the action.
                    <button type="button" className="staff-large" autoFocus onClick={closeNameLarge} onKeyDown={(e) => { if (e.key === 'Tab') e.preventDefault(); }}>
                      <span className="staff-large__text staff-large__text--name" lang="ko"><span>{koName}</span></span>
                      <span className="staff-large__close">{t('detail.tapToClose')}</span>
                    </button>,
                    document.body,
                  )}
                </div>
              )}
              <Link className="detail-report" to={`/submit?place=${place.id}`}>
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
                    const otherStatus = getOpenStatus(other.hours);
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

            {/* 7. Story & Hook */}
            
            <section className="detail-section" ref={storyRef}>
              <SectionHead Icon={BookIcon} title={t('detail.foodStory')} kr="이야기" />
              {/* The UI is translated; a place's own text is not. Say so once,
                  where the English starts, and mark it for screen readers. */}
              {i18n.language !== 'en' && <p className="section-note">{t('detail.contentInEnglish')}</p>}
              <p className="detail-body" lang="en">{place.story}</p>
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
                  <dd>{lastChecked ? formatLongDate(lastChecked, i18n.language) : full ? t('detail.never') : '…'}</dd>
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
