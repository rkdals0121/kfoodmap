import React, { useState, useEffect, useRef } from 'react';
import PlaceImage from './PlaceImage';
import {
  HeartIcon, CompassIcon, XIcon, ClockIcon, MapPinIcon, CrescentIcon,
  MildIcon, FermentIcon, SproutIcon, RecycleIcon, LeafIcon,
  BookIcon, BowlIcon, MenuIcon,
} from './Icons';
import { getCulture } from '../data/culture';
import { haversineKm, formatDistance, getOpenStatus, directionsUrl, coordsOf } from '../utils';
import { dietaryBadges, isKnown, needsCheck } from '../data/verification';

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

export default function RestaurantDetail({
  restaurant, onClose, isBookmarked, onToggleBookmark, mapCenter, focusStory,
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

            {/* 1. Can I eat here? */}
            {facts.length > 0 && (
              <ul className="fact-row" aria-label="Dietary and dining facts">
                {facts.map(({ Icon, label }) => (
                  <li key={label} className="fact">
                    <Icon size={16} aria-hidden="true" /> {label}
                  </li>
                ))}
              </ul>
            )}

            {/* Dietary needs are safety-critical: say plainly that we haven't
                confirmed them, and never let a claimed certificate read as one. */}
            <div className="diet-note">
              {dietFacts.length > 0 ? (
                <p>
                  <strong>Dietary details are unverified.</strong> They come from project
                  research, not from the restaurant. Please confirm with staff before ordering.
                </p>
              ) : (
                <p>
                  <strong>No dietary information yet.</strong> We haven&apos;t confirmed what this
                  kitchen serves, so we don&apos;t make a claim either way.
                </p>
              )}
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
                    <span className="practical-muted">
                      ({restaurant.hours.value}
                      {needsCheck(restaurant.hours) && ', unverified'})
                    </span>
                  </span>
                ) : (
                  <span className="practical-muted">Opening hours unknown — check before you go</span>
                )}
              </div>

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
                      <span className="menu-row__price">{m.price}</span>
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
                Compiled from project research and not yet confirmed with the restaurant.
                Hours, prices and dietary details change — treat this as a starting point
                and check before you travel.
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
                    {isKnown(restaurant.dietary.vegan) || isKnown(restaurant.dietary.halal)
                      ? restaurant.dietary.vegan.source || restaurant.dietary.halal.source
                      : 'Not recorded'}
                  </dd>
                </div>
                <div>
                  <dt>Last checked</dt>
                  <dd>{restaurant.hours.lastCheckedAt ?? 'Never'}</dd>
                </div>
              </dl>
            </footer>
          </div>
        </div>
      </div>
    </>
  );
}
