import { useEffect, useRef } from 'react';
import { MAX_QUERY } from '../search';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CHIP_GROUPS } from '../i18n/labels';
import { OPEN_NOW, OPEN_AT, SAVED_ONLY, FULLY_VEGAN } from '../filters';
import { DAY_KEYS, formatClock, koreaToday } from '../utils';
import { areaSuggestions } from '../data/area-names';

export default function FilterBar({ selectedFilters, onToggleFilter, searchQuery, onSearchChange, onSearchFocus, planAt, onPlanAt, savedCount = 0 }) {
  const { t, i18n } = useTranslation();

  // "/" puts the cursor in the search box, as on most map and search sites.
  // Not while typing somewhere, and not with a modifier held.
  const searchRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target;
      if (el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      // Only when the box can be seen: a place or a sheet over it (a phone's
      // place page, the cards) keeps its own focus; beside a docked place it
      // stays in view and "/" still reaches it.
      const box = searchRef.current;
      if (!box || box.offsetParent === null) return;
      const r = box.getBoundingClientRect();
      if (document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) !== box) return;
      e.preventDefault();
      searchRef.current.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The row is wider than the screen and a chip grows when it is on ("Open
  // at…" becomes "Open Mon 12:00 PM"): bring the one just pressed into view.
  // A link can arrive with a chip on that sits far along the row
  // ("#f=Fermented"): show it, or "Clear (1)" is the only sign of it.
  // Set directly, not scrolled smoothly: this is the first paint.
  const rowRef = useRef(null);
  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector('.chip.active');
    if (!row || !chip) return;
    const r = chip.getBoundingClientRect();
    const box = row.getBoundingClientRect();
    if (r.left < box.left || r.right > box.right) row.scrollLeft += r.left - box.left - 12;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const reveal = (e) => {
    const chip = e.target.closest?.('.chip');
    if (chip) setTimeout(() => chip.scrollIntoView?.({ inline: 'nearest', block: 'nearest', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }), 60);
  };
  // "Saved" leads the row once there is something saved: for someone coming
  // back it is the filter they want, and it sat two screens along the row.
  const savedFirst = savedCount > 0;
  const savedChip = (
    <button
      className={`chip${selectedFilters.includes(SAVED_ONLY) ? ' active' : ''}`}
      aria-pressed={selectedFilters.includes(SAVED_ONLY)}
      onClick={() => onToggleFilter(SAVED_ONLY)}
    >
      {t('filters.savedOnly')}{savedCount > 0 ? ` (${savedCount})` : ''}
    </button>
  );
  const chipGroup = (group) => (
    <div key={group.labelKey} className="chip-group" role="group" aria-label={t(group.labelKey)}>
      {group.chips.map(chip => {
        const isActive = selectedFilters.includes(chip.id);
        return (
          <React.Fragment key={chip.id}>
            <button
              className={`chip${isActive ? ' active' : ''}`}
              aria-pressed={isActive}
              onClick={() => onToggleFilter(chip.id)}
            >
              {t(chip.labelKey)}
            </button>
            {/* Beside Vegan: all-vegan kitchens only (filters.js). */}
            {chip.id === 'Vegan' && (
              <button
                className={`chip${selectedFilters.includes(FULLY_VEGAN) ? ' active' : ''}`}
                aria-pressed={selectedFilters.includes(FULLY_VEGAN)}
                onClick={() => onToggleFilter(FULLY_VEGAN)}
              >
                {t('filters.fullyVegan')}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <header className="home-header">
      {/* A form, so the keyboard's Search key does something: it puts the
          keyboard away, and the results it was covering are in view. */}
      <form className="search-field" role="search" onSubmit={(e) => { e.preventDefault(); searchRef.current?.blur(); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          maxLength={MAX_QUERY}
          ref={searchRef}
          aria-keyshortcuts="/"
          type="search"
          placeholder={t('filters.searchPlaceholder')}
          aria-label={t('filters.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          list="area-suggestions"
          autoComplete="off"
          // Place names are not dictionary words: no "Hongdae" → "Honda".
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          onFocus={onSearchFocus}
        />
        {/* The browsers disagree on whether a search box gets a clear
            button; this one is always there when there is text. */}
        {searchQuery && (
          <button
            type="button"
            className="search-field__clear"
            aria-label={t('filters.clearSearch')}
            onClick={() => { onSearchChange(''); searchRef.current?.focus(); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
        {/* Native suggestions: the areas with the most places. They show
            that the map covers the country and what a search can be. */}
        <datalist id="area-suggestions">
          {areaSuggestions(i18n.language).map(a => <option key={a} value={a} />)}
        </datalist>
      </form>

      <div className="chip-row no-scrollbar" ref={rowRef} onClick={reveal}>
        {/* First in the row: the diet. It is why someone opened this map, and
            on a phone only the first three chips fit before the row scrolls
            — Vegan and Halal used to start off-screen. Then "is it open?". */}
        {savedFirst && savedChip}
        {chipGroup(CHIP_GROUPS[0])}
        <div className="chip-group" role="group" aria-label={t('filters.groupNow')}>
          <button
            className={`chip${selectedFilters.includes(OPEN_NOW) ? ' active' : ''}`}
            aria-pressed={selectedFilters.includes(OPEN_NOW)}
            onClick={() => onToggleFilter(OPEN_NOW)}
          >
            {t('filters.openNow')}
          </button>
          {/* The same question for another time: tomorrow's lunch, Sunday's
              dinner. Many kitchens here close one fixed weekday. */}
          {planAt && (
            <button
              className={`chip${selectedFilters.includes(OPEN_AT) ? ' active' : ''}`}
              aria-pressed={selectedFilters.includes(OPEN_AT)}
              aria-expanded={selectedFilters.includes(OPEN_AT)}
              aria-controls="plan-row"
              onClick={() => onToggleFilter(OPEN_AT)}
            >
              {selectedFilters.includes(OPEN_AT)
                ? t('filters.openAtSet', { day: t(`hours.day.${DAY_KEYS[planAt.day]}`), time: formatClock(planAt.minutes) })
                : t('filters.openAt')}
            </button>
          )}
          {!savedFirst && savedChip}
        </div>
        {CHIP_GROUPS.slice(1).map(chipGroup)}
      </div>

      {planAt && selectedFilters.includes(OPEN_AT) && (
        <div className="plan-row" id="plan-row" role="group" aria-label={t('filters.openAt')}>
          <label>
            <span>{t('filters.openAtDay')}</span>
            <select value={planAt.day} onChange={(e) => onPlanAt({ ...planAt, day: Number(e.target.value) })}>
              {/* The week from today, in Korea. */}
              {Array.from({ length: 7 }, (_, i) => (koreaToday() + i) % 7).map((d, i) => (
                <option key={d} value={d}>
                  {i === 0 ? `${t('filters.today')} (${t(`hours.day.${DAY_KEYS[d]}`)})`
                    : i === 1 ? `${t('filters.tomorrow')} (${t(`hours.day.${DAY_KEYS[d]}`)})`
                      : t(`hours.day.${DAY_KEYS[d]}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('filters.openAtTime')}</span>
            <select value={planAt.minutes} onChange={(e) => onPlanAt({ ...planAt, minutes: Number(e.target.value) })}>
              {Array.from({ length: 48 }, (_, i) => i * 30).map(m => (
                <option key={m} value={m}>{formatClock(m)}</option>
              ))}
            </select>
          </label>
          <span className="plan-row__tz">{t('filters.koreanTime')}</span>
        </div>
      )}
    </header>
  );
}
