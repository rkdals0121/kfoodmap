import React, { useState, useEffect, useRef } from 'react';
import PlaceImage from './PlaceImage';
import {
  HeartIcon, CompassIcon, XIcon, ClockIcon, MapPinIcon, CrescentIcon,
  MildIcon, FermentIcon, SproutIcon, RecycleIcon, LeafIcon, RouteIcon,
  BookIcon, BowlIcon, MenuIcon,
} from './Icons';
import { getCulture } from '../data/culture';
import { haversineKm, formatDistance, getOpenStatus, directionsUrl } from '../utils';

// "Can I eat here?" — dietary tags rendered as icon facts
const FACT_META = {
  'Vegan': { Icon: LeafIcon, label: 'Vegan' },
  'Halal': { Icon: CrescentIcon, label: 'Halal friendly' },
  'Mild Taste': { Icon: MildIcon, label: 'Mild taste' },
  'Fermented': { Icon: FermentIcon, label: 'Fermented' },
  'Zero-waste': { Icon: RecycleIcon, label: 'Zero waste' },
  'Local Sourcing': { Icon: SproutIcon, label: 'Locally sourced' },
};

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
  const distance = mapCenter
    ? formatDistance(haversineKm(mapCenter[0], mapCenter[1], restaurant.lat, restaurant.lng))
    : null;
  const facts = restaurant.tags.map(t => FACT_META[t]).filter(Boolean);

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
    try {
      await navigator.clipboard.writeText(restaurant.address);
      ok = true;
    } catch {
      ok = fallbackCopy(restaurant.address);
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
                <span className="place-card__star" aria-hidden="true">★</span> {restaurant.rating}
                <span className="detail-meta__muted"> ({restaurant.reviews})</span>
                <span aria-hidden="true"> · </span>{restaurant.zone}
                {distance && <><span aria-hidden="true"> · </span>{distance}</>}
              </p>
            </header>

            {/* 1. Can I eat here? */}
            {facts.length > 0 && (
              <ul className="fact-row" aria-label="Dietary compatibility">
                {facts.map(({ Icon, label }) => (
                  <li key={label} className="fact">
                    <Icon size={16} aria-hidden="true" /> {label}
                  </li>
                ))}
              </ul>
            )}

            {/* 2. How do I get there? */}
            <div className="practical">
              <div className="practical-row">
                <ClockIcon size={17} />
                {status ? (
                  <span>
                    <strong className={status.open ? 'is-open' : 'is-closed'}>{status.label}</strong>
                    {' '}· {status.detail} <span className="practical-muted">({restaurant.hours})</span>
                  </span>
                ) : (
                  <span className="practical-muted">Hours not verified yet — check locally</span>
                )}
              </div>

              <div className="practical-row">
                <MapPinIcon size={17} />
                <span>{restaurant.address}</span>
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
            {restaurant.menus?.length > 0 && (
              <section className="detail-section">
                <SectionHead Icon={MenuIcon} title="Signature Menu" />
                <div className="menu-rows">
                  {restaurant.menus.map(m => (
                    <div key={m.name} className="menu-row">
                      <span>{m.name}</span>
                      <span className="menu-row__price">{m.price}</span>
                    </div>
                  ))}
                </div>
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

            {/* 5. Why is it sustainable? */}
            <section className="detail-section">
              <SectionHead Icon={LeafIcon} title="Sustainability" />
              <div className="sus-rows">
                <div className="practical-row">
                  <LeafIcon size={17} />
                  <span>{restaurant.esg_point}</span>
                </div>
                <div className="practical-row">
                  <RouteIcon size={17} />
                  <span>
                    <strong>{restaurant.food_mile} km</strong> food mileage
                    <span className="practical-muted"> — roughly how far the ingredients traveled to reach your plate</span>
                  </span>
                </div>
              </div>
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
          </div>
        </div>
      </div>
    </>
  );
}
