import React, { useRef, useState } from 'react';
import { displayName } from '../utils';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  SparkleIcon, UserIcon, ChevronRightIcon, BowlIcon, GlobeIcon, MapPinIcon, InfoIcon, LockIcon, LogOutIcon, TrashIcon,
} from './Icons';
import { restaurants } from '../data/restaurants';
import { isQuarantined, dietaryBadges, trustBadge } from '../data/verification';
import { journeys } from '../data/journeys';
import Prologue from './Prologue';
import ClaimChip from './ClaimChip';
import { LANGUAGE_STORAGE_KEY } from '../i18n/index.js';

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
  .map(j => ({ ...j, stops: j.stopIds.map(id => byId[id]) }))
  .filter(j => j.stops.every(place => place && !isQuarantined(place)));

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
  return parts.length ? t('discover.journeyClaims', { summary: parts.join(', ') }) : null;
}

function DiscoverTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section className="tab-panel discover-panel">
      {resolvedJourneys.length > 0 && (
        <>
          <div className="tab-panel-header">
            {/* Not the compass: that glyph means "get directions" on cards. */}
            <span className="panel-icon" aria-hidden="true"><BowlIcon size={24} /></span>
            <h2>{t('discover.journeysTitle')}</h2>
            <p>{t('discover.journeysSubtitle')}</p>
          </div>

          <div className="journey-list">
            {resolvedJourneys.map(journey => (
              <article key={journey.id} className="journey-card">
                <h3 className="journey-card__title">{journey.title}</h3>
                <p className="journey-card__description">{journey.description}</p>
                <ol className="journey-card__stops">
                  {journey.stops.map((place, i) => (
                    <li key={place.id}>
                      <button
                        className="journey-stop"
                        onClick={() => navigate(`/place/${place.id}`)}
                      >
                        <span className="journey-stop__num">{i + 1}</span>
                        {/* The page promises each stop says how sure we are:
                            so each stop carries its claim marks. */}
                        <span className="journey-stop__text">
                          <span className="journey-stop__name">{displayName(place.name)}</span>
                          <span className="journey-stop__zone">{place.zone}</span>
                          <span className="journey-stop__claims">
                            {dietaryBadges(place).map(b => <ClaimChip key={b.key} kind={b.key} label={b.label} fact={b.fact} />)}
                          </span>
                        </span>
                        <ChevronRightIcon size={16} />
                      </button>
                    </li>
                  ))}
                </ol>
                {claimSummary(journey.stops, t) && (
                  <p className="journey-card__claims">{claimSummary(journey.stops, t)}</p>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      <div className="tab-panel-header">
        <span className="panel-icon" aria-hidden="true"><SparkleIcon size={24} /></span>
        <h2>{t('discover.cultureTitle')}</h2>
        <p>{t('discover.cultureSubtitle')}</p>
      </div>

      <div className="story-grid">
        {cultureStories.map(place => (
          <article key={place.id} className="story-card" onClick={() => navigate(`/place/${place.id}`)}>
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

// Only English exists today -- LANGUAGES grows when a second locale file
// is added under src/i18n/locales/ and registered in src/i18n/index.js.
// The picker is built to scale to that list without a component change.
const LANGUAGES = [{ code: 'en', labelKey: 'profile.languageEnglish' }];

function LanguagePicker({ onClose }) {
  const { t, i18n } = useTranslation();

  const selectLanguage = (code) => {
    i18n.changeLanguage(code);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    onClose();
  };

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
      <div className="language-picker" onClick={(e) => e.stopPropagation()}>
        {LANGUAGES.map(lang => (
          <button
            key={lang.code}
            className={`language-picker__option${i18n.language === lang.code ? ' active' : ''}`}
            onClick={() => selectLanguage(lang.code)}
          >
            {t(lang.labelKey)}
          </button>
        ))}
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
  const aboutOpener = useRef(null);
  const navigate = useNavigate();
  const currentLanguage = LANGUAGES.find(l => l.code === i18n.language) ?? LANGUAGES[0];

  const confirmThenDelete = () => {
    if (window.confirm(t('profile.deleteRecordsConfirm'))) onDeleteRecords();
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
    { label: t('profile.language'), value: t(currentLanguage.labelKey), icon: <GlobeIcon size={20} />, action: LANGUAGES.length > 1 ? () => setLanguagePickerOpen(true) : null },
    { label: t('profile.suggestRestaurant'), value: '', icon: <MapPinIcon size={20} />, action: () => navigate('/submit') },
    // Shows the opening screen again: what the map is and how to read a claim.
    { label: t('profile.aboutApp'), value: '', icon: <InfoIcon size={20} />, action: () => { aboutOpener.current = document.activeElement; setAboutOpen(true); } },
    { label: t('profile.privacyPolicy'), value: '', icon: <LockIcon size={20} />, action: () => navigate('/privacy') },
  ];

  return (
    <section className="tab-panel profile-panel">
      <div className="tab-panel-header">
        <span className="panel-icon" aria-hidden="true"><UserIcon size={24} /></span>
        <h2>{t('profile.settingsTitle')}</h2>
        <p>{t('profile.settingsSubtitle')}</p>
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

      <div className="settings-list">
        {settings.map((item, idx) => (item.action ? (
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

      {session && (
        <div className="settings-list settings-list--account">
          <span className="settings-section-label">{t('profile.accountSection')}</span>
          <button type="button" className="settings-item" onClick={onSignOut}>
            <span className="settings-icon" aria-hidden="true"><LogOutIcon size={20} /></span>
            <span className="settings-text">
              <span className="settings-label">{t('profile.signOut')}</span>
            </span>
            <span className="settings-value">{t('profile.signOutHint')}</span>
            <ChevronRightIcon size={18} />
          </button>
          <button type="button" className="settings-item settings-item--danger" onClick={confirmThenDelete}>
            <span className="settings-icon" aria-hidden="true"><TrashIcon size={20} /></span>
            <span className="settings-text">
              <span className="settings-label">{t('profile.deleteRecords')}</span>
            </span>
            <ChevronRightIcon size={18} />
          </button>
        </div>
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
  lastSyncFailed, sessionEnded, signInFailed, savedCount, visitedCount,
}) {
  if (tab === 'discover') return <DiscoverTab />;
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
