import React from 'react';
import { useTranslation } from 'react-i18next';
import { paren } from '../i18n/punct';

const icons = {
  map: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  ),
  discover: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2.1 5-5 2.1 2.1-5z" />
    </svg>
  ),
  journal: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" />
      <path d="M5 4v14" />
      <path d="M9 8h5M9 12h5" />
    </svg>
  ),
  profile: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  ),
};

const tabIds = ['map', 'discover', 'journal', 'profile'];

export default function TabBar({ activeTab, onSelect, isCollapsed, savedCount = 0, covered = false }) {
  const { t } = useTranslation();

  return (
    <nav className="tab-bar" aria-label={t('app.primaryNav')} inert={covered || undefined}>
      {tabIds.map(id => (
        <button
          key={id}
          className={`tab-item${activeTab === id ? ' active' : ''}`}
          aria-current={activeTab === id ? 'page' : undefined}
          onClick={() => onSelect(id)}
          title={isCollapsed ? t(`tabBar.${id}`) : undefined}
        >
          {icons[id]}
          {/* Someone coming back sees at once that their places are here. */}
          {id === 'journal' && savedCount > 0 && <span className="tab-count" aria-hidden="true">{savedCount > 99 ? '99+' : savedCount}</span>}
          <span className="tab-label">{t(`tabBar.${id}`)}</span>
          {id === 'journal' && savedCount > 0 && <span className="visually-hidden">{paren('', savedCount)}</span>}
        </button>
      ))}
    </nav>
  );
}
