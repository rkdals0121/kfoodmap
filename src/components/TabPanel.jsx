import React, { useEffect, useRef, useState } from 'react';
import { TEXT_SIZES, applyTextSize, readTextSize } from '../textSize';
import { askFreshList } from '../freshList';
import { displayName, formatDistance, getOpenStatus, statusClass, closedAllDay } from '../utils';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  SparkleIcon, UserIcon, ChevronRightIcon, BowlIcon, GlobeIcon, MapPinIcon, InfoIcon, LockIcon, LogOutIcon, TrashIcon, BookIcon,
} from './Icons';
import { restaurants } from '../data/restaurants';
import { isQuarantined, dietaryBadges, trustBadge } from '../data/verification';
import { journeys } from '../data/journeys';
import { legDistances } from '../data/journey-nav';
import useInstall from '../hooks/useInstall';
import { askConfirm } from '../confirm';
import { useBackToClose, useInertRoot } from '../hooks/useOverlay';
import { matchesArea } from '../filters';
import { matchesDietary } from '../data/verification';
import { AREA_NAMES } from '../data/area-names';
import { CHIP_GROUPS } from '../i18n/labels';
import Prologue from './Prologue';
import ClaimChip from './ClaimChip';
import { LANGUAGES, setLanguage } from '../i18n/index.js';

// Stories for Discover's culture section, by id: the old name lookups had
// quietly stopped matching three of four places, leaving one card. A place
// that is gone or quarantined drops out rather than opening a dead page.
const CULTURE_STORY_IDS = [
  'balwoo',               // Buddhist temple food, Seoul
  'gamloheon-jeonju',     // yakseon, food as medicine, Jeonju
  'osegyehyang',          // Korean-Chinese classics made vegan, Insadong
  'vegenarang-gwangalli', // temple-style food, Busan
];

// A journey's stops must all still be active — if any one of them were ever
// quarantined, the editorial claim ("three verified restaurants...") would
// no longer be true, so the whole journey is dropped rather than shown with
// a silently missing stop.
const byId = Object.fromEntries(restaurants.map(r => [r.id, r]));
const cultureStories = CULTURE_STORY_IDS
  .map(id => byId[id])
  .filter(place => place && !isQuarantined(place));
const resolvedJourneys = journeys
  // `text` keeps the journey object itself: its title and description are
  // read from the locale at render time, and a spread here would freeze
  // them in whatever language was loaded first.
  .map(j => ({ id: j.id, text: j, stops: j.stopIds.map(id => byId[id]) }))
  .filter(j => j.stops.every(place => place && !isQuarantined(place)))
  .map(j => ({ ...j, legs: legDistances(j.stops) }));

// How sure the map is about a journey's dietary claims, counted across its
// stops, so being curated never lends a place more certainty than its own
// record has (docs/UI-DIRECTION.md). Words, in the claim-mark vocabulary.
function claimSummary(stops, t) {
  const order = ['strong', 'medium', 'weak'];
  const counts = {};
  for (const place of stops) {
    for (const b of dietaryBadges(place)) {
      const { label, tone } = trustBadge(b.fact);
      counts[tone] = counts[tone] ?? { label, n: 0 };
      counts[tone].n += 1;
    }
  }
  const parts = order.filter(k => counts[k]).map(k => `${counts[k].n} ${counts[k].label.toLowerCase()}`);
  return parts.length ? t('discover.journeyClaims', { summary: parts.join(/^(zh|ja)/.test(document.documentElement.lang) ? '、' : ', ') }) : null;
}

// "Halal in Busan", "Vegan in Jeju": how many places each well-known area
// has for each diet, most first — the same sets as the web's area guides
// (scripts/prerender-places.mjs), counted once from the bundled records.
const BROWSE_MIN = 3;
const BROWSE_MAX = 12;
// Counted on first use, not at start-up: only Discover needs it.
let browseCache = null;
const browse = () => browseCache ?? (browseCache = CHIP_GROUPS.flatMap(g => g.chips)
  .filter(c => c.id === 'Vegan' || c.id === 'Halal')
  .map(chip => ({
    chip,
    areas: Object.keys(AREA_NAMES)
      .map(area => ({
        area,
        count: restaurants.filter(r => !isQuarantined(r) && matchesDietary(r, chip.id) && matchesArea(r, area)).length,
      }))
      .filter(a => a.count >= BROWSE_MIN)
      .sort((a, b) => b.count - a.count)
      .slice(0, BROWSE_MAX),
  })));

// Where the reader was in Discover, for this visit: which journeys were
// open and how far down. "Show on the map" and Back used to return to the
// top with everything folded again.
const discoverMemory = { open: new Map(), scrollTop: 0 };

// A journey's stops, folded on a phone: seven journeys open in full made
// Discover ten screens long, with the stories under all of it. The title,
// what it is, how sure the claims are and "show on the map" stay in view;
// the stops open on a tap. From 768 px, where there is room, they start open.
function JourneyStops({ id, title, count, children }) {
  const { t } = useTranslation();
  // What the reader last chose for this journey, open or folded; without a
  // choice, folded on a phone and open where there is room.
  const [open, setOpenState] = useState(() => discoverMemory.open.get(id)
    ?? (typeof window !== 'undefined' && Boolean(window.matchMedia?.('(min-width: 768px)').matches)));
  const setOpen = (fn) => setOpenState(o => {
    const next = fn(o);
    discoverMemory.open.set(id, next);
    return next;
  });
  return (
    <>
      <button type="button" className="journey-card__toggle" aria-expanded={open} aria-label={`${title}: ${t('discover.stopsCount', { n: count })}`} onClick={() => setOpen(o => !o)}>
        {t('discover.stopsCount', { n: count })}
        <ChevronRightIcon size={16} />
      </button>
      {open && children}
    </>
  );
}

function DiscoverTab({ onBrowse }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  // Korean readers get the Korean name (first in each list); everyone else
  // the romanised one, as on signs and in the records.
  const areaName = (area) => (i18n.language === 'ko' ? AREA_NAMES[area][0] : area);
  const panelRef = useRef(null);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return undefined;
    el.scrollTop = discoverMemory.scrollTop;
    const onScroll = () => { discoverMemory.scrollTop = el.scrollTop; };
    el.addEventListener('scroll', onScroll, { passive: true });
    // Also at the tap that leaves: a scroll event can still be pending.
    el.addEventListener('click', onScroll, true);
    return () => { el.removeEventListener('scroll', onScroll); el.removeEventListener('click', onScroll, true); };
  }, []);

  return (
    <section className="tab-panel discover-panel" ref={panelRef}>
      {resolvedJourneys.length > 0 && (
        <>
          <div className="tab-panel-header">
            {/* Not the compass: that glyph means "get directions" on cards. */}
            <span className="panel-icon" aria-hidden="true"><BowlIcon size={24} /></span>
            <h2>{t('discover.journeysTitle')}</h2>
            <p>{t('discover.journeysSubtitle')}</p>
            {/* The cards are the most useful thing here for someone standing
                in a restaurant; Profile alone hid them. */}
            <button type="button" className="discover-cards-link" onClick={() => navigate('/cards', { state: { fromApp: true, tab: 'discover' } })}>
              <span>{t('cards.title')}</span>
              <ChevronRightIcon size={16} />
            </button>
          </div>

          {onBrowse && (
            <div className="browse-areas">
              <h3 className="browse-areas__title">{t('discover.byArea')}</h3>
              {browse().map(({ chip, areas }) => (
                <div key={chip.id} className="browse-areas__row" role="group" aria-label={t(chip.labelKey)}>
                  <span className="browse-areas__diet">{t(chip.labelKey)}</span>
                  <div className="browse-areas__links">
                    {areas.map(({ area, count }) => (
                      // A real address (the web's area guide), opened in the
                      // app as that search and chip on the map.
                      <a
                        key={area}
                        className="browse-areas__link"
                        href={`/find/${chip.id.toLowerCase()}-${area.toLowerCase()}`}
                        onClick={(e) => { e.preventDefault(); onBrowse(chip.id, areaName(area)); }}
                      >
                        {areaName(area)} <span className="browse-areas__count">{count}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="journey-list">
            {resolvedJourneys.map(journey => (
              <article key={journey.id} className="journey-card">
                <h3 className="journey-card__title">{journey.text.title}</h3>
                <p className="journey-card__description">{journey.text.description}</p>
                {/* A day off recorded for today, said before the stops: the
                    plan for today needs it first. Never guessed from
                    missing hours. */}
                {journey.stops.some(p => closedAllDay(p.hours)) && (
                  <p className="journey-card__closed">
                    {t('discover.closedToday', { closed: journey.stops.filter(p => closedAllDay(p.hours)).length, total: journey.stops.length })}
                  </p>
                )}
                <JourneyStops id={journey.id} title={journey.text.title} count={journey.stops.length}>
                <ol className="journey-card__stops">
                  {journey.stops.map((place, i) => (
                    <li key={place.id}>
                      <button
                        className="journey-stop"
                        onClick={() => navigate(`/place/${place.id}`, { state: { fromApp: true, tab: 'discover', journey: { id: journey.id, index: i } } })}
                      >
                        <span className="journey-stop__num" aria-hidden="true">{i + 1}</span>
                        <span className="visually-hidden">{t('detail.journeyPrev', { index: i + 1 })}: </span>
                        {/* The page promises each stop says how sure we are:
                            so each stop carries its claim marks. */}
                        <span className="journey-stop__text">
                          <span className="journey-stop__name">{displayName(place.name)}</span>
                          <span className="journey-stop__zone">
                            {place.zone}
                            {/* How far apart the stops are, so "a half-day"
                                can be judged before setting out. A straight
                                line, and said to be one. */}
                            {journey.legs[i] != null && (
                              <> · {t('discover.legFromPrevious', { distance: formatDistance(journey.legs[i]), stop: i })}</>
                            )}
                          </span>
                          {/* Open now or not, so a stop shut today is seen
                              before setting out rather than at its door. */}
                          <span className="journey-stop__status">
                            {(() => {
                              const status = getOpenStatus(place.hours);
                              return status
                                ? <><span className={statusClass(status)}>{status.label}</span>{status.detail && <> · {status.detail}</>}</>
                                : <span className="place-card__unknown">{t('list.hoursUnknown')}</span>;
                            })()}
                          </span>
                          <span className="journey-stop__claims">
                            {dietaryBadges(place).map(b => <ClaimChip key={b.key} kind={b.key} label={b.label} fact={b.fact} />)}
                          </span>
                        </span>
                        <ChevronRightIcon size={16} />
                      </button>
                    </li>
                  ))}
                </ol>
                </JourneyStops>
                {claimSummary(journey.stops, t) && (
                  <p className="journey-card__claims">{claimSummary(journey.stops, t)}</p>
                )}
                {/* The stops alone on the map: how far apart they really
                    are is easier seen than read. */}
                <button
                  type="button"
                  className="journey-card__map"
                  onClick={() => { askFreshList(); navigate(`/?list=${journey.stops.map(p => p.id).join(',')}&journey=${journey.id}`); }}
                >
                  {t('discover.showOnMap')}
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      <div className="tab-panel-header">
        <span className="panel-icon" aria-hidden="true"><SparkleIcon size={24} /></span>
        <h2>{t('discover.cultureTitle')}</h2>
        <p>{t('discover.cultureSubtitle')}</p>
        {/* Said here as on a place's page: the stories below are English. */}
        {i18n.language !== 'en' && <p className="practical-muted">{t('detail.contentInEnglish')}</p>}
      </div>

      <div className="story-grid">
        {cultureStories.map(place => (
          <article key={place.id} className="story-card" onClick={() => navigate(`/place/${place.id}`, { state: { fromApp: true, tab: 'discover', focusStory: true } })}>
            <div className="story-card-content">
              <p className="story-card__kind">{t('discover.storyLabel')}</p>
              <h3>{displayName(place.name)}</h3>
              <p>{place.story.split('.')[0] + '.'}</p>
              <button className="story-card-btn" aria-label={t('list.readStoryAria', { name: displayName(place.name) })}>{t('discover.readStory')} <ChevronRightIcon size={14} /></button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// A phone with a plus: "put this on the home screen".
const HomeAddIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6" y="2" width="12" height="20" rx="2.5" />
    <path d="M12 9v6M9 12h6" />
  </svg>
);

// Text size: three steps, shown as the letter at each size. On this device
// only (src/textSize.js).
function TextSizeRow() {
  const { t } = useTranslation();
  const [size, setSize] = useState(readTextSize);
  const choose = (next) => { setSize(next); applyTextSize(next, true); };
  const LABEL = { normal: 'profile.textNormal', large: 'profile.textLarge', larger: 'profile.textLarger' };
  return (
    <div className="settings-item settings-item--static text-size">
      <span className="settings-icon text-size__icon" aria-hidden="true">Aa</span>
      <span className="settings-text">
        <span className="settings-label" id="text-size-label">{t('profile.textSize')}</span>
      </span>
      <span className="text-size__choices" role="group" aria-labelledby="text-size-label">
        {TEXT_SIZES.map(s => (
          <button
            key={s}
            type="button"
            className={`text-size__btn text-size__btn--${s}${s === size ? ' is-on' : ''}`}
            aria-pressed={s === size}
            title={t(LABEL[s])}
            onClick={() => choose(s)}
          >
            {/* Named by the letter it shows and what it means. */}
            A<span className="visually-hidden"> {t(LABEL[s])}</span>
          </button>
        ))}
      </span>
    </div>
  );
}

function LanguagePicker({ onClose }) {
  const { t, i18n } = useTranslation();

  // The strings are fetched on demand (i18n/index.js); close once the
  // language has actually changed, or stay as it was if it could not.
  // On a slow link the strings take seconds: the choice shows it is being
  // fetched, and a failure is said here rather than by closing in silence.
  const [pending, setPending] = useState(null);
  const [failed, setFailed] = useState(false);
  const selectLanguage = (code) => {
    setPending(code);
    setFailed(false);
    // Ten seconds, then it is a failure: a stalled connection never answers
    // and every other language stayed greyed out.
    const asked = setLanguage(code);
    Promise.race([asked, new Promise(resolve => setTimeout(resolve, 10000))]).then((got) => {
      if (got === code) { onClose(); return; }
      // Given up on here, but still on its way: if it lands after all, the
      // language has changed and the picker closes rather than say it failed.
      asked.then((late) => { if (late === code) onClose(); });
      setPending(null);
      setFailed(true);
    });
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Focus goes back to the Language row when the sheet closes.
  useEffect(() => {
    const opener = document.activeElement;
    return () => { if (opener && document.contains(opener)) opener.focus?.({ preventScroll: true }); };
  }, []);

  // Rendered via a portal to document.body rather than in place: .tab-panel
  // is `position: fixed; z-index: 12` (src/index.css), which establishes its
  // own stacking context. Any z-index on a descendant -- no matter how large
  // -- only ranks against other descendants of .tab-panel; it can never win
  // against a sibling subtree like .tab-bar (z-index 200 on mobile) that
  // sits outside .tab-panel entirely. Confirmed empirically: without the
  // portal, the picker rendered in place but the mobile tab bar painted over
  // it and intercepted every click, whatever value .language-picker-overlay's
  // z-index had. The portal escapes that trap so the overlay's z-index: 500
  // (src/index.css) is actually compared at the document root, where it
  // resolves the way the rule's own comment intends.
  return createPortal(
    <div className="language-picker-overlay" onClick={onClose}>
      <div className="language-picker" role="dialog" aria-modal="true" aria-label={t('profile.chooseLanguage')} onClick={(e) => e.stopPropagation()}>
        <div className="language-picker__head">
          <h2 className="language-picker__title">{t('profile.chooseLanguage')}</h2>
          <button type="button" className="language-picker__close" aria-label={t('detail.close')} onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {/* Each language in its own name and marked with its own lang, so
            it reads (and is spoken) correctly whatever the current one is. */}
        {LANGUAGES.map((lang, i) => (
          <button
            key={lang.code}
            lang={lang.html}
            autoFocus={i18n.language === lang.code || (i === 0 && !LANGUAGES.some(l => l.code === i18n.language))}
            className={`language-picker__option${i18n.language === lang.code ? ' active' : ''}`}
            aria-pressed={i18n.language === lang.code}
            aria-busy={pending === lang.code}
            aria-disabled={pending !== null && pending !== lang.code}
            onClick={() => { if (pending === null) selectLanguage(lang.code); }}
          >
            {lang.name}{pending === lang.code ? ' …' : ''}
          </button>
        ))}
        {/* Always here, so a screen reader hears it fill in. */}
        <p className="visually-hidden" role="status">{pending ? t('profile.languageLoading') : ''}</p>
        {failed && <p className="language-picker__note language-picker__note--failed" role="alert">{t('profile.languageFailed')}</p>}
        <p className="language-picker__note">{t('profile.languageNote')}</p>
      </div>
    </div>,
    document.body,
  );
}

// Everything about accounts arrives as props — this file stays free of
// Supabase imports, so the Profile tab renders identically in a build where
// sync does not exist.
function ProfileTab({
  onNavigate, session, googleReady, onSignIn, onSignOut, onDeleteRecords,
  lastSyncFailed, sessionEnded, signInFailed, savedCount, visitedCount,
}) {
  const { t, i18n } = useTranslation();
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const aboutOpener = useRef(null);
  const { state: installable, install } = useInstall();
  useBackToClose(languagePickerOpen, () => setLanguagePickerOpen(false));
  // Behind the language sheet and About, the panel is inert; and focus
  // returns to the Language row (the sheet's own note of its opener was
  // taken after focus had already moved inside it).
  useInertRoot(languagePickerOpen || aboutOpen);
  const languageOpener = useRef(null);
  const wasPicking = useRef(false);
  useEffect(() => {
    if (wasPicking.current && !languagePickerOpen) languageOpener.current?.focus?.({ preventScroll: true });
    wasPicking.current = languagePickerOpen;
  }, [languagePickerOpen]);
  useBackToClose(aboutOpen, () => setAboutOpen(false));
  const [iosHelp, setIosHelp] = useState(false);
  const navigate = useNavigate();
  const currentLanguage = LANGUAGES.find(l => l.code === i18n.language) ?? LANGUAGES[0];

  const confirmThenDelete = async () => {
    if (await askConfirm(t('profile.deleteRecordsConfirm'), { confirmLabel: t('profile.deleteRecords') })) onDeleteRecords();
  };

  // googleReady gates the sign-in control and nothing else: a button that
  // cannot work is worse than no button. It must NOT gate the signed-in
  // state — googleEnabled answers false on any error, and a restored session
  // plus one flaky readiness probe would otherwise leave someone signed in
  // and syncing with no email shown, no sign-out and no way to stop it.
  //
  // `sessionEnded` opens the control even when googleReady is false. That is
  // not a weakening of the gate: a session existed on this device a moment
  // ago, which is proof the provider IS configured, so a false probe there is
  // the answer googleEnabled gives on any error — and without this the person
  // is left with an emptied Journal, the sentence explaining it, and no way
  // to act on either.
  const canSignIn = (googleReady || sessionEnded) && !session;

  // Only rows that do something. "Food Preferences" and "Dietary Preferences"
  // used to sit here reading "Not set" and doing nothing on tap, and a saved-
  // places row duplicated both the Journal tab and the counts above it. In an
  // app that refuses to show a dietary claim it cannot back, a control that
  // does nothing is the same class of untruth.
  const settings = [
    // A picker with one choice implies a choice that isn't there: until a
    // second language ships, the row just states the language.
    { label: t('profile.language'), value: currentLanguage.name, icon: <GlobeIcon size={20} />, action: () => { languageOpener.current = document.activeElement; setLanguagePickerOpen(true); } },
    { custom: <TextSizeRow /> },
    { label: t('profile.staffCards'), value: '', icon: <BookIcon size={20} />, action: () => navigate('/cards', { state: { fromApp: true, tab: 'profile' } }) },
    // Only where it can do something: a browser that offered the install,
    // or iOS, where the row explains the two taps it takes.
    ...(installable === 'prompt' || installable === 'ios' ? [{
      label: t('profile.install'),
      value: t('profile.installHint'),
      icon: <HomeAddIcon />,
      action: installable === 'prompt' ? install : () => setIosHelp(v => !v),
    }] : []),
    { label: t('profile.suggestRestaurant'), value: '', icon: <MapPinIcon size={20} />, action: () => navigate('/submit', { state: { fromApp: true, tab: 'profile' } }) },
    // Shows the opening screen again: what the map is and how to read a claim.
    { label: t('profile.aboutApp'), value: '', icon: <InfoIcon size={20} />, action: () => { aboutOpener.current = document.activeElement; setAboutOpen(true); } },
    { label: t('profile.privacyPolicy'), value: '', icon: <LockIcon size={20} />, action: () => navigate('/privacy', { state: { fromApp: true, tab: 'profile' } }) },
  ];

  return (
    <section className="tab-panel profile-panel">
      <div className="tab-panel-header">
        <span className="panel-icon" aria-hidden="true"><UserIcon size={24} /></span>
        <h2>{t('profile.settingsTitle')}</h2>
        <p>{t('profile.settingsSubtitle')}</p>
      </div>

      {/* First, where a thumb finds them: someone who cannot read this
          language needs the Language row without scrolling past a card. */}
      <div className="settings-list">
        {settings.map((item, idx) => (item.custom ? (
          <React.Fragment key={idx}>{item.custom}</React.Fragment>
        ) : item.action ? (
          <button type="button" key={idx} className="settings-item" onClick={item.action}>
            <span className="settings-icon" aria-hidden="true">{item.icon}</span>
            <span className="settings-text">
              <span className="settings-label">{item.label}</span>
            </span>
            {item.value && <span className="settings-value">{item.value}</span>}
            <ChevronRightIcon size={18} />
          </button>
        ) : (
          <div key={idx} className="settings-item settings-item--static">
            <span className="settings-icon" aria-hidden="true">{item.icon}</span>
            <span className="settings-text">
              <span className="settings-label">{item.label}</span>
            </span>
            {item.value && <span className="settings-value">{item.value}</span>}
          </div>
        )))}
      </div>

      {/* The question this screen exists to answer — where the saved places
          live, and whether losing this phone loses them. It borrows the
          Journal's passport cover deliberately: same object, different
          question, so the two screens read as one thing seen twice. */}
      <div className="profile-custody">
        <span className="profile-custody__eyebrow">{t('profile.passport')}</span>
        <h3 className="profile-custody__title">
          {session ? t('profile.custodyAccount') : t('profile.custodyDevice')}
        </h3>
        {session
          ? <p className="profile-custody__line">{session.user?.email}</p>
          : <p className="profile-custody__line">{t('profile.custodyDeviceHint')}</p>}

        <button
          type="button"
          className="profile-custody__stats"
          onClick={() => onNavigate('journal')}
        >
          <span className="profile-custody__stat">
            {/* Same words and counts as the Journal: places still to visit,
                and places visited. */}
            <strong>{savedCount - visitedCount}</strong> {t('journal.toVisit')}
          </span>
          <span className="profile-custody__stat">
            <strong>{visitedCount}</strong> {t('journal.visited')}
          </span>
          <ChevronRightIcon size={16} />
        </button>

        {canSignIn && (
          <button type="button" className="profile-custody__cta" onClick={onSignIn}>
            {t('profile.signInGoogle')}
          </button>
        )}
      </div>

      {/* Said before anything else on this screen, because it is the reason
          the Journal is empty and the reason to press sign in. Shown only
          while signed out; signing in again clears it. */}
      {sessionEnded && !session && (
        <p className="profile-notice profile-notice--warn" role="status">{t('profile.sessionEnded')}</p>
      )}
      {/* Shown when a sign-in was started and did not arrive — a refusal at
          Google's consent screen, an unreachable provider, a chunk that
          would not load. Without it the app simply looks signed out, which
          is what it looked like before the button was pressed. */}
      {signInFailed && !session && (
        <p className="profile-notice profile-notice--warn" role="status">{t('profile.signInFailed')}</p>
      )}
      {/* Said plainly, and never instead of the places: they are still here,
          it is the sync that failed. Only a signed-in device syncs, so only a
          signed-in device can say this. */}
      {session && lastSyncFailed && (
        <p className="profile-notice profile-notice--warn" role="status">{t('profile.syncFailed')}</p>
      )}

      {session && (
        <div className="settings-list settings-list--account">
          <span className="settings-section-label">{t('profile.accountSection')}</span>
          {/* Signing out waits on the network: the row shows it was pressed. */}
          <button type="button" className="settings-item" aria-disabled={signingOut} aria-busy={signingOut}
            // aria-disabled, not disabled: a disabled button drops focus, and the
            // question that may follow had nowhere to return it.
            onClick={() => { if (signingOut) return; setSigningOut(true); Promise.resolve(onSignOut()).finally(() => setSigningOut(false)); }}>
            <span className="settings-icon" aria-hidden="true"><LogOutIcon size={20} /></span>
            <span className="settings-text">
              <span className="settings-label">{t('profile.signOut')}{signingOut ? ' …' : ''}</span>
            </span>
            <span className="settings-value">{t('profile.signOutHint')}</span>
            <ChevronRightIcon size={18} />
          </button>
          <button type="button" className="settings-item settings-item--danger" aria-disabled={signingOut} onClick={() => { if (!signingOut) confirmThenDelete(); }}>
            <span className="settings-icon" aria-hidden="true"><TrashIcon size={20} /></span>
            <span className="settings-text">
              <span className="settings-label">{t('profile.deleteRecords')}</span>
            </span>
            <ChevronRightIcon size={18} />
          </button>
        </div>
      )}

      {installable === 'ios' && iosHelp && (
        <p className="profile-notice" role="status">{t('profile.installIos')}</p>
      )}
      {languagePickerOpen && <LanguagePicker onClose={() => setLanguagePickerOpen(false)} />}
      {aboutOpen && createPortal(
        <Prologue dialog ctaKey="prologue.close" onComplete={() => { setAboutOpen(false); aboutOpener.current?.focus(); }} />,
        document.body,
      )}
    </section>
  );
}

export default function TabPanel({
  tab, onNavigate, session, googleReady, onSignIn, onSignOut, onDeleteRecords,
  lastSyncFailed, sessionEnded, signInFailed, savedCount, visitedCount, onBrowse,
}) {
  if (tab === 'discover') return <DiscoverTab onBrowse={onBrowse} />;
  if (tab === 'profile') {
    return (
      <ProfileTab
        onNavigate={onNavigate}
        session={session}
        googleReady={googleReady}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        onDeleteRecords={onDeleteRecords}
        lastSyncFailed={lastSyncFailed}
        sessionEnded={sessionEnded}
        signInFailed={signInFailed}
        savedCount={savedCount}
        visitedCount={visitedCount}
      />
    );
  }
  return null;
}
