import React from 'react';
import { useTranslation } from 'react-i18next';
import { CHIP_GROUPS } from '../i18n/labels';

export default function FilterBar({ selectedFilters, onToggleFilter, searchQuery, onSearchChange }) {
  const { t } = useTranslation();

  return (
    <header className="home-header">
      <div className="search-field">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          placeholder={t('filters.searchPlaceholder')}
          aria-label={t('filters.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="chip-row no-scrollbar">
        {CHIP_GROUPS.map(group => (
          <div key={group.labelKey} className="chip-group" role="group" aria-label={t(group.labelKey)}>
            {group.chips.map(chip => {
              const isActive = selectedFilters.includes(chip.id);
              return (
                <button
                  key={chip.id}
                  className={`chip${isActive ? ' active' : ''}`}
                  aria-pressed={isActive}
                  onClick={() => onToggleFilter(chip.id)}
                >
                  {t(chip.labelKey)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </header>
  );
}
