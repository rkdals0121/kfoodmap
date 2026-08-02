import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { SparkleIcon, UserIcon, ChevronRightIcon, CompassIcon } from './Icons';
import { restaurants } from '../data/restaurants';
import { isQuarantined } from '../data/verification';
import { journeys } from '../data/journeys';
import PlaceImage from './PlaceImage';

// Pick some interesting stories for Discover
const cultureStories = [
  restaurants.find(r => r.name.includes('Balwoo')), // Temple Cuisine
  restaurants.find(r => r.name.includes('Myeongdong Kyoja')), // Noodles/Kimchi
  restaurants.find(r => r.name.includes('Gwangjang')), // Street Food
  restaurants.find(r => r.name.includes('Jungsik')), // Modern Korean
].filter(Boolean);

// A journey's stops must all still be active — if any one of them were ever
// quarantined, the editorial claim ("three verified restaurants...") would
// no longer be true, so the whole journey is dropped rather than shown with
// a silently missing stop.
const byId = Object.fromEntries(restaurants.map(r => [r.id, r]));
const resolvedJourneys = journeys
  .map(j => ({ ...j, stops: j.stopIds.map(id => byId[id]) }))
  .filter(j => j.stops.every(place => place && !isQuarantined(place)));

function DiscoverTab({ onNavigate }) {
  const navigate = useNavigate();

  return (
    <section className="tab-panel discover-panel">
      {resolvedJourneys.length > 0 && (
        <>
          <div className="tab-panel-header">
            <span className="panel-icon" aria-hidden="true"><CompassIcon size={24} /></span>
            <h2>Food Journeys</h2>
            <p>Themed half-days through already-verified restaurants.</p>
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
                        <PlaceImage place={place} variant="thumb" className="journey-stop__img" />
                        <span className="journey-stop__text">
                          <span className="journey-stop__name">{place.name.split('(')[0].trim()}</span>
                          <span className="journey-stop__zone">{place.zone}</span>
                        </span>
                        <ChevronRightIcon size={16} />
                      </button>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </>
      )}

      <div className="tab-panel-header">
        <span className="panel-icon" aria-hidden="true"><SparkleIcon size={24} /></span>
        <h2>Culture Hub</h2>
        <p>Explore the history and traditions behind Korean food.</p>
      </div>

      <div className="story-grid">
        {cultureStories.map(place => (
          <article key={place.id} className="story-card" onClick={() => onNavigate('map')}>
            <PlaceImage place={place} variant="hero" className="story-card-img" />
            <div className="story-card-content">
              <h3>{place.name.split('(')[0].trim()}</h3>
              <p>{place.story.split('.')[0] + '.'}</p>
              <button className="story-card-btn">Read Story <ChevronRightIcon size={14} /></button>
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
const LANGUAGE_STORAGE_KEY = 'kfm-language';

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

function ProfileTab({ onNavigate }) {
  const { t } = useTranslation();
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);

  const settings = [
    { label: t('profile.language'), value: t('profile.languageEnglish'), icon: '🌐', action: () => setLanguagePickerOpen(true) },
    { label: 'Food Preferences', value: 'Not set', icon: '🍲' },
    { label: 'Dietary Preferences', value: 'Not set', icon: '🌱' },
    { label: 'Saved Places', value: 'View Journal', icon: '❤️', action: () => onNavigate('journal') },
    { label: 'About K-Food Map', value: 'v1.0', icon: 'ℹ️' },
    { label: 'Privacy Policy', value: '', icon: '🔒' },
  ];

  return (
    <section className="tab-panel profile-panel">
      <div className="tab-panel-header">
        <span className="panel-icon" aria-hidden="true"><UserIcon size={24} /></span>
        <h2>Settings</h2>
        <p>Manage your preferences and app settings.</p>
      </div>

      <div className="settings-list">
        {settings.map((item, idx) => (
          <div key={idx} className="settings-item" onClick={item.action}>
            <span className="settings-icon">{item.icon}</span>
            <div className="settings-text">
              <span className="settings-label">{item.label}</span>
            </div>
            {item.value && <span className="settings-value">{item.value}</span>}
            <ChevronRightIcon size={18} />
          </div>
        ))}
      </div>

      {languagePickerOpen && <LanguagePicker onClose={() => setLanguagePickerOpen(false)} />}
    </section>
  );
}

export default function TabPanel({ tab, onNavigate }) {
  if (tab === 'discover') return <DiscoverTab onNavigate={onNavigate} />;
  if (tab === 'profile') return <ProfileTab onNavigate={onNavigate} />;
  return null;
}
