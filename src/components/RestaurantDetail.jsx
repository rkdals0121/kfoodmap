import React, { useState, useEffect, useRef } from 'react';
import PlaceImage from './PlaceImage';
import {
  HeartIcon, CompassIcon, XIcon, ClockIcon, MapPinIcon, CrescentIcon,
  MildIcon, FermentIcon, SproutIcon, RecycleIcon, LeafIcon,
  BookIcon, BowlIcon, MenuIcon, TrainIcon, PhoneIcon, LinkIcon, CheckIcon,
} from './Icons';
import { getCulture } from '../data/culture';
import { haversineKm, formatDistance, getOpenStatus, todaysHours, directionsUrl, coordsOf } from '../utils';
import {
  dietaryBadges, isKnown, needsCheck, trustBadge, dietaryConfidence, CONFIDENCE,
} from '../data/verification';

// Descriptive traits rendered as icon facts. Dietary facts come from the
// structured dietary record instead, so their wording matches the evidence.
const TRAIT_META = {
  'Mild Taste': { Icon: MildIcon, label: 'Mild taste' },
  'Fermented': { Icon: FermentIcon, label: 'Fermented' },
  'Zero-waste': { Icon: RecycleIcon, label: 'Zero waste' },
  'Local Sourcing': { Icon: SproutIcon, label: 'Locally sourced' },
};

const DIETARY_ICON = { vegan: LeafIcon, halal: CrescentIcon };

function SectionHead({ Icon, title, kr }) {
  return (
    <div className="section-head">
      <span className="section-head__icon" aria-hidden="true"><Icon size={17} /></span>
      <h3>{title}{kr && <span className="section-head__kr"> · {kr}</span>}</h3>
    </div>
  );
}

/** One badge collapsing a fact's confidence and source, with the reason on hover. */
function Trust({ fact }) {
  const { label, tone, detail } = trustBadge(fact);
  return <span className={`trust trust--${tone}`} title={detail}>{label}</span>;
}

// What the dietary caveat should say, keyed to the weakest level on the record.
const DIET_CAVEAT = {
  [CONFIDENCE.CONFIRMED]: {
    title: 'Confirmed with the restaurant.',
    body: 'The kitchen states this itself. Menus still change, so ask if you have a strict requirement.',
  },
  [CONFIDENCE.SUPPORTED]: {
    title: 'Reported, not confirmed.',
    body: 'These details come from what the restaurant and our research describe. We haven’t checked them in person — confirm with staff before ordering.',
  },
  [CONFIDENCE.INFERRED]: {
    // Covers both bases we infer from: the kind of kitchen, and the venue's own
    // branding. Neither is a stated claim about what's actually served.
    title: 'Partly our own reading.',
    body: 'Some of this we read from the kind of kitchen it is, or from how the venue describes itself — not from a stated fact. Treat it as a lead and ask staff before ordering.',
  },
  [CONFIDENCE.UNKNOWN]: {
    title: 'No dietary information yet.',
    body: 'We haven’t established what this kitchen serves, so we don’t make a claim either way.',
  },
};

export default function RestaurantDetail({
  restaurant, onClose, isBookmarked, onToggleBookmark, isVisited, onToggleVisited,
  mapCenter, focusStory,
}) {
  const [copied, setCopied] = useState(false);
  const storyRef = useRef(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    setCopied(false);
    if (!restaurant) return;
    if (focusStory && storyRef.current) {
      storyRef.current.scrollIntoView({ block: 'start' });
    } else {
      sheetRef.current?.focus();
    }
  }, [restaurant, focusStory]);

  useEffect(() => {
    if (!restaurant) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [restaurant, onClose]);

  if (!restaurant) return null;

  const name = restaurant.name.split('(')[0].trim();
  const status = getOpenStatus(restaurant.hours);
  const today = todaysHours(restaurant.hours);
  const culture = getCulture(restaurant);
  const coords = coordsOf(restaurant);
  const distance = mapCenter
    ? formatDistance(haversineKm(mapCenter[0], mapCenter[1], coords.lat, coords.lng))
    : null;

  // Quick Facts: what we know about the diet first, then descriptive traits.
  const dietFacts = dietaryBadges(restaurant).map(b => ({
    Icon: DIETARY_ICON[b.key], label: b.label, fact: b.fact,
  }));
  const traitFacts = restaurant.traits
    .map(t => TRAIT_META[t])
    .filter(Boolean)
    .map(t => ({ ...t, fact: null }));
  const facts = [...dietFacts, ...traitFacts];
  const certClaim = restaurant.dietary.halalCertClaim;
  const caveat = DIET_CAVEAT[dietaryConfidence(restaurant)] ?? DIET_CAVEAT[CONFIDENCE.UNKNOWN];
  // The most recent check across every fact on the record.
  const lastChecked = [
    restaurant.coordinates, restaurant.address, restaurant.hours, restaurant.menus,
    restaurant.phone, restaurant.officialUrl, restaurant.instagram, restaurant.transit,
    restaurant.dietary.vegan, restaurant.dietary.halal,
  ].map(f => f?.lastCheckedAt).filter(Boolean).sort().at(-1);

  // Clipboard API needs focus/permission (in-app browsers often lack it) — fall back to execCommand
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
    const address = restaurant.address.value;
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

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />

      <div className="detail-sheet" role="dialog" aria-modal="true" aria-label={name} ref={sheetRef} tabIndex={-1}>
        <button className="detail-close" aria-label="Close" onClick={onClose}>
          <XIcon size={18} />
        </button>

        <div className="detail-scroll">
          <PlaceImage place={restaurant} variant="hero" />

          <div className="detail-content">
            <header className="detail-header">
              <h2>{restaurant.name}</h2>
              <p className="detail-meta">
                {restaurant.zone}
                {distance && <><span aria-hidden="true"> · </span>{distance}</>}
              </p>
            </header>

            {/* 1. Can I eat here? Each dietary fact carries how far we trust it,
                so "the kitchen says it's vegan" doesn't read like "we checked". */}
            {facts.length > 0 && (
              <ul className="fact-row" aria-label="Dietary and dining facts">
                {facts.map(({ Icon, label, fact: f }) => (
                  <li key={label} className="fact">
                    <Icon size={16} aria-hidden="true" /> {label}
                    {f && <Trust fact={f} />}
                  </li>
                ))}
              </ul>
            )}

            {/* Dietary needs are safety-critical: name the weakest level on the
                record, and never let a claimed certificate read as one. */}
            <div className="diet-note">
              <p>
                <strong>{caveat.title}</strong> {caveat.body}
              </p>
              {certClaim && (
                <p className="diet-note__cert">
                  Certification claimed: {certClaim.body} — we have not sighted the certificate.
                </p>
              )}
            </div>

            {/* 2. How do I get there? */}
            <div className="practical">
              <div className="practical-row">
                <ClockIcon size={17} />
                {status ? (
                  <span>
                    <strong className={status.open ? 'is-open' : 'is-closed'}>{status.label}</strong>
                    {' '}· {status.detail}{' '}
                    {today && <span className="practical-muted">(today {today})</span>}
                    {needsCheck(restaurant.hours) && <Trust fact={restaurant.hours} />}
                  </span>
                ) : (
                  <span className="practical-muted">
                    Opening hours unknown — check before you go
                  </span>
                )}
              </div>

              {isKnown(restaurant.transit) && (
                <div className="practical-row">
                  <TrainIcon size={17} />
                  <span>
                    {restaurant.transit.value.station} {restaurant.transit.value.line}
                    {restaurant.transit.value.exit && `, exit ${restaurant.transit.value.exit}`}
                    {' '}· {restaurant.transit.value.walkingMinutes} min walk
                    <span className="practical-muted"> ({restaurant.transit.value.distanceM} m)</span>
                  </span>
                </div>
              )}

              <div className="practical-row">
                <MapPinIcon size={17} />
                <span>
                  {restaurant.address.value}
                  {restaurant.address.precision === 'area' && (
                    <span className="practical-muted"> — area only, exact address unknown</span>
                  )}
                </span>
                <button className="practical-copy" onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {isKnown(restaurant.phone) && (
                <div className="practical-row">
                  <PhoneIcon size={17} />
                  <a className="practical-link" href={`tel:${restaurant.phone.value.replace(/-/g, '')}`}>
                    {restaurant.phone.value}
                  </a>
                </div>
              )}

              {(isKnown(restaurant.officialUrl) || isKnown(restaurant.instagram)) && (
                <div className="practical-row">
                  <LinkIcon size={17} />
                  <span className="practical-links">
                    {isKnown(restaurant.officialUrl) && (
                      <a className="practical-link" href={restaurant.officialUrl.value} target="_blank" rel="noreferrer noopener">
                        Website
                      </a>
                    )}
                    {isKnown(restaurant.instagram) && (
                      <a className="practical-link" href={restaurant.instagram.value} target="_blank" rel="noreferrer noopener">
                        Instagram
                      </a>
                    )}
                  </span>
                </div>
              )}

              <div className="practical-actions">
                <button className="btn-primary" onClick={() => window.open(directionsUrl(restaurant), '_blank')}>
                  <CompassIcon size={18} /> Get Directions
                </button>
                <button
                  className={`icon-btn icon-btn--lg${isBookmarked ? ' icon-btn--saved' : ''}`}
                  aria-label={isBookmarked ? `Remove ${name} from journal` : `Save ${name} to journal`}
                  aria-pressed={isBookmarked}
                  onClick={() => onToggleBookmark(restaurant.id)}
                >
                  <HeartIcon size={21} filled={isBookmarked} />
                </button>
                {/* A visit is recorded on a saved place, so this stays disabled
                    until the place is in the journal (see App.jsx invariant) */}
                <button
                  className={`icon-btn icon-btn--lg${isVisited ? ' icon-btn--visited' : ''}`}
                  aria-label={
                    !isBookmarked
                      ? `Save ${name} to your journal before marking it visited`
                      : isVisited
                        ? `Mark ${name} as not visited`
                        : `Mark ${name} as visited`
                  }
                  aria-pressed={isVisited}
                  disabled={!isBookmarked}
                  onClick={() => onToggleVisited(restaurant.id)}
                >
                  <CheckIcon size={21} />
                </button>
              </div>
            </div>

            {/* Signature menu */}
            {isKnown(restaurant.menus) && (
              <section className="detail-section">
                <SectionHead Icon={MenuIcon} title="Signature Menu" />
                <div className="menu-rows">
                  {restaurant.menus.value.map(m => (
                    <div key={m.name} className="menu-row">
                      <span>{m.name}</span>
                      {/* A dish we know of but have no price for says so,
                          rather than showing a blank where a number goes. */}
                      <span className="menu-row__price">{m.price ?? 'Price not listed'}</span>
                    </div>
                  ))}
                </div>
                {needsCheck(restaurant.menus) && (
                  <p className="section-note">Dishes and prices are unverified and may have changed.</p>
                )}
              </section>
            )}

            {/* 3. Why is this place special? — the hook, kept short on purpose */}
            <section className="detail-hook">
              <p className="detail-hook__label">Why it's special</p>
              <p className="detail-hook__quote">&ldquo;{restaurant.vibe}&rdquo;</p>
            </section>

            {/* 4. What does this food tell me about Korea? */}
            <section className="detail-section" ref={storyRef}>
              <SectionHead Icon={BookIcon} title="The Food Story" kr="이야기" />
              <p className="detail-body">{restaurant.story}</p>
              <div className="callout">
                <p className="callout__label">Did you know?</p>
                <p>{culture.didYouKnow}</p>
              </div>
            </section>

            {/* 5. Why is it sustainable?
                The food-mileage figure that used to sit here was invented, so it
                is gone rather than replaced with another guess. */}
            <section className="detail-section">
              <SectionHead Icon={LeafIcon} title="Sustainability" />
              <div className="sus-rows">
                <div className="practical-row">
                  <LeafIcon size={17} />
                  <span>{restaurant.esg_point}</span>
                </div>
              </div>
              <p className="section-note">
                Described by the restaurant and our research; not independently audited.
              </p>
            </section>

            {/* 6. What should I know before eating? */}
            <section className="detail-section">
              <SectionHead Icon={BowlIcon} title="Dining Tips" />
              <ul className="tips-list">
                {culture.diningTips.map(tip => (
                  <li key={tip} className="tip">
                    <span className="tip__dot" aria-hidden="true" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Provenance: what this page rests on, stated plainly. */}
            <footer className="provenance">
              <p className="provenance__title">About this information</p>
              <p>
                <strong>Official</strong> means we checked it against a map service or registry;
                <strong> Reported</strong> means a source states it; <strong>Inferred</strong> means
                we read it from context. Hours, prices and dietary details change — treat this as
                a starting point.
              </p>
              <dl className="provenance__list">
                <div>
                  <dt>Location</dt>
                  <dd>
                    {restaurant.coordinates.source}
                    {restaurant.address.precision === 'area' && ' · address is area-level'}
                  </dd>
                </div>
                <div>
                  <dt>Dietary</dt>
                  <dd>
                    {dietFacts.length > 0
                      ? [...new Set(dietFacts.map(f => f.fact.source))].join(' · ')
                      : 'Not recorded'}
                  </dd>
                </div>
                <div>
                  <dt>Last checked</dt>
                  <dd>{lastChecked ?? 'Never'}</dd>
                </div>
              </dl>
            </footer>
          </div>
        </div>
      </div>
    </>
  );
}
