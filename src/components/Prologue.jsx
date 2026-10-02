import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { restaurants } from '../data/restaurants';
import { isQuarantined } from '../data/verification';
import ClaimChip from './ClaimChip';
import './Prologue.css';

const activeCount = restaurants.filter(r => !isQuarantined(r)).length;

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

// Also opened later from Profile → About, as a dialog (`dialog`), where the
// button closes it rather than opening the map.
export default function Prologue({ onComplete, dialog = false, ctaKey = 'prologue.continue' }) {
  const { t } = useTranslation();
  const ctaRef = useRef(null);
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
        <p className="prologue-eyebrow">K-Food Map</p>
        <h1 id="prologue-title" className="prologue-title">{t('prologue.title')}</h1>
        <p className="prologue-subtitle">{t('prologue.subtitle', { activeCount })}</p>

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

        <button ref={ctaRef} className="prologue-btn" onClick={onComplete}>{t(ctaKey)}</button>
      </Wrapper>
    </div>
  );
}
