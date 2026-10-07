import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CHIP_GROUPS } from '../i18n/labels';
// The number of places on the map, counted at build (vite.config.js): this
// screen is shown before the places themselves have been downloaded.
import { activeCount } from 'virtual:kfm-place-count';
import ClaimChip from './ClaimChip';
import { LANGUAGES, setLanguage } from '../i18n/index.js';
import './Prologue.css';

// One screen: what this map is, and how to read the claim mark that sits on
// every dietary claim in it (docs/UI-DIRECTION.md). It replaced three steps,
// the last a 1.5 s "Opening the map…" spinner that loaded nothing. There is
// deliberately no location step: location is asked only when someone presses
// “My location” on the map (data/locate.js), never on arrival.
const LEGEND = [
  { tone: 'strong', kind: 'vegan', chipKey: 'prologue.legendConfirmedChip', levelKey: 'trust.confirmed', bodyKey: 'prologue.legendConfirmed' },
  { tone: 'medium', kind: 'halal', chipKey: 'prologue.legendReportedChip', levelKey: 'trust.reported', bodyKey: 'prologue.legendReported' },
  { tone: 'weak', kind: 'vegan', chipKey: 'prologue.legendReadingChip', levelKey: 'trust.inferred', bodyKey: 'prologue.legendReading' },
  { tone: 'none', kind: null, chipKey: null, levelKey: 'trust.unknown', bodyKey: 'prologue.legendUnknown' },
];

// The two diets the map is for, by their chip ids and labels (i18n/labels.js).
const START_DIETS = CHIP_GROUPS.flatMap(g => g.chips).filter(c => c.id === 'Vegan' || c.id === 'Halal');

// Also opened later from Profile → About, as a dialog (`dialog`), where the
// button closes it rather than opening the map.
export default function Prologue({ onComplete, dialog = false, ctaKey = 'prologue.continue' }) {
  const { t, i18n } = useTranslation();
  const ctaRef = useRef(null);
  // First run: what the visitor is here for, so the map opens on it. It
  // only turns chips on, which the map shows and can turn off.
  // Both can be on: a table of friends is often some of each.
  const [diet, setDiet] = useState([]);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  useEffect(() => {
    if (!dialog) return undefined;
    ctaRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onCompleteRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  const Wrapper = dialog ? 'div' : 'main';
  return (
    <div
      className="prologue-layout"
      {...(dialog ? { role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'prologue-title' } : {})}
    >
      <Wrapper className="prologue-content">
        {/* First run only: someone who cannot read this screen needs the
            switch here, not three taps away in Profile. */}
        {!dialog && (
          <div className="prologue-languages" role="group" aria-label={t('profile.chooseLanguage')}>
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                type="button"
                lang={lang.html}
                className={`prologue-language${i18n.language === lang.code ? ' is-current' : ''}`}
                aria-pressed={i18n.language === lang.code}
                onClick={() => setLanguage(lang.code)}
              >
                {lang.name}
              </button>
            ))}
          </div>
        )}
        <p className="prologue-eyebrow">K-Food Map</p>
        <h1 id="prologue-title" className="prologue-title">{t('prologue.title')}</h1>
        <p className="prologue-subtitle">{t('prologue.subtitle', { activeCount })}</p>

        {/* Before the legend, so it is seen without scrolling on a phone. */}
        {!dialog && (
          <div className="prologue-start" role="group" aria-labelledby="prologue-start-title">
            <p id="prologue-start-title" className="prologue-start__title">{t('prologue.startWith')}</p>
            <div className="prologue-start__chips">
              {START_DIETS.map(({ id, labelKey }) => (
                <button
                  key={id}
                  type="button"
                  className={`prologue-language${diet.includes(id) ? ' is-current' : ''}`}
                  aria-pressed={diet.includes(id)}
                  onClick={() => setDiet(d => (d.includes(id) ? d.filter(x => x !== id) : [...d, id]))}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
            <p className="prologue-start__hint">{t('prologue.startHint')}</p>
          </div>
        )}

        <section className="prologue-legend" aria-labelledby="prologue-legend-title">
          <h2 id="prologue-legend-title" className="prologue-legend__title">{t('prologue.legendTitle')}</h2>
          <ul>
            {LEGEND.map(({ tone, kind, chipKey, levelKey, bodyKey }) => (
              <li key={tone} className="prologue-legend__row">
                <ClaimChip kind={kind} label={chipKey ? t(chipKey) : null} level={t(levelKey)} tone={tone} />
                <span className="prologue-legend__body">{t(bodyKey)}</span>
              </li>
            ))}
          </ul>
          <p className="prologue-legend__note">{t('prologue.legendNote')}</p>
        </section>

        <button ref={ctaRef} className="prologue-btn" onClick={() => onComplete(diet)}>{t(ctaKey)}</button>
      </Wrapper>
    </div>
  );
}
