import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useTranslation, Trans } from 'react-i18next';
import PlaceImage from './PlaceImage';
import {
  HeartIcon, CompassIcon, XIcon, ClockIcon, MapPinIcon, CrescentIcon,
  MildIcon, FermentIcon, SproutIcon, RecycleIcon, LeafIcon,
  BookIcon, BowlIcon, MenuIcon, TrainIcon, PhoneIcon, LinkIcon, CheckIcon, ShareIcon,
} from './Icons';
import { getCulture } from '../data/culture';
import { haversineKm, formatDistance, getOpenStatus, todaysHours, directionsUrl, naverMapUrl, kakaoMapUrl, coordsOf, formatLongDate, displayName } from '../utils';
import {
  dietaryBadges, isKnown, needsCheck, trustBadge, dietaryConfidence, CONFIDENCE,
} from '../data/verification';
import { sourceLabel } from '../i18n/labels';
import usePlaceRecord from '../hooks/usePlaceRecord';

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
  return (
    <div className="section-head">
      <span className="section-head__icon" aria-hidden="true"><Icon size={17} /></span>
      <h3>{title}{kr && <span className="section-head__kr"> · {kr}</span>}</h3>
    </div>
  );
}

function Trust({ fact }) {
  const { label, tone, detail } = trustBadge(fact);
  return <span className={`trust trust--${tone}`} title={detail}>{label}</span>;
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
  restaurant, onClose, isBookmarked, onToggleBookmark, isVisited, onToggleVisited,
  mapCenter, focusStory,
}) {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const storyRef = useRef(null);
  const sheetRef = useRef(null);
  // The bundle carries a lighter record; the full one (evidence, menus,
  // transit, phone, links) is fetched when the detail opens.
  const full = usePlaceRecord(restaurant);

  useEffect(() => {
    setCopied(false);
    setShared(false);
    if (!restaurant) return;
    if (focusStory && storyRef.current) {
      storyRef.current.scrollIntoView({ block: 'start' });
    } else {
      sheetRef.current?.focus();
    }
  }, [restaurant, focusStory]);

  useEffect(() => {
    if (!restaurant) return undefined;
    const onKey = (e) => { 
      if (e.key === 'Escape') {
        if (galleryOpen) {
          e.stopPropagation();
          setGalleryOpen(false);
        } else {
          onClose(); 
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [restaurant, onClose, galleryOpen]);

  if (!restaurant) return null;

  const place = full ?? restaurant;

  const name = displayName(place.name);
  const status = getOpenStatus(place.hours);
  const today = todaysHours(place.hours);
  const culture = getCulture(place);
  const coords = coordsOf(place);
  const distance = mapCenter
    ? formatDistance(haversineKm(mapCenter[0], mapCenter[1], coords.lat, coords.lng))
    : null;

  const dietFacts = dietaryBadges(place).map(b => ({ id: b.key, Icon: DIETARY_ICON[b.key], label: b.label, fact: b.fact }));
  const traitFacts = place.traits.filter(id => TRAIT_META[id])
    .map(id => ({ id, Icon: TRAIT_META[id].Icon, label: t(TRAIT_META[id].labelKey), fact: null }));
  const facts = [...dietFacts, ...traitFacts];
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
    const shareUrl = window.location.href;
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
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-sheet" role="dialog" aria-modal="true" aria-label={name} ref={sheetRef} tabIndex={-1}>
        <button className="detail-close" aria-label={t('detail.close')} onClick={onClose}>
          <XIcon size={18} />
        </button>

        <div className="detail-scroll">
          {/* 1. Hero Image */}
          <PlaceImage place={place} variant="hero" onClick={galleryImages.length > 0 ? () => setGalleryOpen(true) : undefined} />

          <div className="detail-content">
            {/* 2. Restaurant Name */}
            <header className="detail-header">
              <h2>{place.name}</h2>
              <p className="detail-meta">
                {place.zone}
                {distance && <><span aria-hidden="true"> · </span>{distance}</>}
                {/* Open/closed up here too, as on the list card: it is the first thing
                    a traveller acts on. The detail stays in the hours row below. */}
                {status && (
                  <><span aria-hidden="true"> · </span><strong className={status.open ? 'is-open' : 'is-closed'}>{status.label}</strong></>
                )}
              </p>
            </header>

            {/* 3. Diet Tags */}
            {facts.length > 0 && (
              <ul className="fact-row" aria-label={t('detail.dietaryFactsLabel')}>
                {facts.map(({ id, Icon, label, fact: f }) => (
                  <li key={id} className="fact">
                    <Icon size={16} aria-hidden="true" /> {label}
                    {f && <Trust fact={f} />}
                  </li>
                ))}
              </ul>
            )}

            <div className="diet-note">
              <p><strong>{caveat.title}</strong> {caveat.body}</p>
              {certClaim && (
                <p className="diet-note__cert">
                  {certClaim.note
                    ? t('detail.certificationClaimedNote', { body: certClaim.body, note: certClaim.note })
                    : t('detail.certificationClaimed', { body: certClaim.body })}
                </p>
              )}
            </div>

            {/* Menus, transit, phone and links arrive with the full record
                (usePlaceRecord). Say so while it loads, so the sheet doesn't
                look finished and then grow; offline the line never shows. */}
            {!full && typeof navigator !== 'undefined' && navigator.onLine !== false && (
              <p className="detail-loading" role="status">{t('detail.loadingDetails')}</p>
            )}

            {/* 4. Representative Menu */}
            {isKnown(place.menus) && (
              <section className="detail-section">
                <SectionHead Icon={MenuIcon} title={t('detail.signatureMenu')} />
                <div className="menu-rows">
                  {place.menus.value.map(m => (
                    <div key={m.name} className="menu-row">
                      <span>{m.name}</span>
                      <span className="menu-row__price">{m.price ?? t('detail.priceNotListed')}</span>
                    </div>
                  ))}
                </div>
                {needsCheck(place.menus) && (
                  <p className="section-note">{t('detail.menuUnverified')}</p>
                )}
              </section>
            )}

            {/* 5. Quick Information (Hours, Transit, Links, Actions) */}
            <div className="practical">
              <div className="practical-row">
                <ClockIcon size={17} />
                {status ? (
                  <span>
                    <strong className={status.open ? 'is-open' : 'is-closed'}>{status.label}</strong>
                    {' '}· {status.detail}{' '}
                    {today && <span className="practical-muted">{t('detail.todayHours', { hours: today })}</span>}
                  </span>
                ) : (
                  <span className="practical-muted">{t('detail.hoursUnknown')}</span>
                )}
              </div>

              {isKnown(place.transit) && (
                <div className="practical-row">
                  <TrainIcon size={17} />
                  <span>
                    {place.transit.value.station} {place.transit.value.line}
                    {place.transit.value.exit && t('detail.transitExit', { exit: place.transit.value.exit })}
                    {t('detail.transitWalk', { minutes: place.transit.value.walkingMinutes })}
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

              <div className="practical-actions">
                <button
                  className={`icon-btn icon-btn--lg${isBookmarked ? ' icon-btn--saved' : ''}`}
                  aria-label={isBookmarked ? t('list.removeAria', { name }) : t('list.saveAria', { name })}
                  onClick={() => onToggleBookmark(place.id)}
                >
                  <HeartIcon size={21} filled={isBookmarked} />
                </button>
                <button
                  className={`icon-btn icon-btn--lg${isVisited ? ' icon-btn--visited' : ''}`}
                  aria-label={isVisited ? t('detail.visitedUnmark', { name }) : t('detail.visitedMark', { name })}
                  disabled={!isBookmarked}
                  onClick={() => onToggleVisited(place.id)}
                >
                  <CheckIcon size={21} />
                </button>
                <button
                  className="icon-btn icon-btn--lg"
                  aria-label={t('detail.shareAria', { name })}
                  onClick={handleShare}
                  title={shared ? t('detail.shared') : t('detail.share')}
                >
                  <ShareIcon size={21} />
                </button>
              </div>
            </div>

            {/* 6. Story & Hook */}
            <section className="detail-hook">
              <p className="detail-hook__label">{t('detail.whyItsSpecial')}</p>
              <p className="detail-hook__quote">&ldquo;{place.vibe}&rdquo;</p>
            </section>
            
            <section className="detail-section" ref={storyRef}>
              <SectionHead Icon={BookIcon} title={t('detail.foodStory')} kr="이야기" />
              <p className="detail-body">{place.story}</p>
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

            {/* 7. Directions / Address */}
            <section className="detail-section">
              <SectionHead Icon={CompassIcon} title={t('detail.locationDirections')} />
              
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

              <div className="detail-directions">
                <button className="btn-primary" onClick={() => window.open(directionsUrl(place, mapCenter), '_blank')}>
                  Google Maps
                </button>
                <button className="btn-primary btn-primary--naver" onClick={() => window.open(naverMapUrl(place, mapCenter), '_blank')}>
                  Naver Map
                </button>
                <button className="btn-primary btn-primary--kakao" onClick={() => window.open(kakaoMapUrl(place, mapCenter), '_blank')}>
                  Kakao Map
                </button>
              </div>
              <Link className="detail-report" to={`/submit?place=${place.id}`}>
                {t('submit.reportLink')}
              </Link>
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
                <Trans i18nKey="detail.provenanceReportedSentence" components={[<strong key="0" />]} /> <Trans i18nKey="detail.provenanceInferredSentence" components={[<strong key="0" />]} />
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
                      ? [...new Set(dietFacts.map(f => sourceLabel(f.fact.source)))].join(' · ')
                      : t('detail.notRecorded')}
                  </dd>
                </div>
                <div>
                  <dt>{t('detail.lastChecked')}</dt>
                  <dd>{lastChecked ?? t('detail.never')}</dd>
                </div>
              </dl>
            </footer>
            
            <div className="transparency-log">
              {lastChecked && (
                <p>{t('detail.lastVerified', { date: formatLongDate(lastChecked, i18n.language) })}</p>
              )}
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
