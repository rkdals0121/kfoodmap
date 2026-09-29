import React from 'react';
import { useTranslation } from 'react-i18next';
import { restaurants } from '../data/restaurants';
import { isQuarantined } from '../data/verification';
import './Prologue.css';

const activeCount = restaurants.filter(r => !isQuarantined(r)).length;

// One screen: what this map is, and how to read the claim mark that sits on
// every dietary claim in it (docs/UI-DIRECTION.md). It replaced three steps,
// the last a 1.5 s "Opening the map…" spinner that loaded nothing. There is
// deliberately no location step: the app never requests the device's location.
const LEGEND = [
  { level: 'confirmed', chipKey: 'prologue.legendConfirmedChip', levelKey: 'trust.confirmed', bodyKey: 'prologue.legendConfirmed' },
  { level: 'reported', chipKey: 'prologue.legendReportedChip', levelKey: 'trust.reported', bodyKey: 'prologue.legendReported' },
  { level: 'reading', chipKey: 'prologue.legendReadingChip', levelKey: 'trust.inferred', bodyKey: 'prologue.legendReading' },
  { level: 'unknown', chipKey: null, levelKey: 'trust.unknown', bodyKey: 'prologue.legendUnknown' },
];

export default function Prologue({ onComplete }) {
  const { t } = useTranslation();

  return (
    <div className="prologue-layout">
      <main className="prologue-content">
        <p className="prologue-eyebrow">K-Food Map</p>
        <h1 className="prologue-title">{t('prologue.title')}</h1>
        <p className="prologue-subtitle">{t('prologue.subtitle', { activeCount })}</p>

        <section className="prologue-legend" aria-labelledby="prologue-legend-title">
          <h2 id="prologue-legend-title" className="prologue-legend__title">{t('prologue.legendTitle')}</h2>
          <ul>
            {LEGEND.map(({ level, chipKey, levelKey, bodyKey }) => (
              <li key={level} className="prologue-legend__row">
                <span className={`tag-chip claim claim--${level}`}>
                  {chipKey ? <>{t(chipKey)}<span className="claim__level">{t(levelKey)}</span></> : t(levelKey)}
                </span>
                <span className="prologue-legend__body">{t(bodyKey)}</span>
              </li>
            ))}
          </ul>
          <p className="prologue-legend__note">{t('prologue.legendNote')}</p>
        </section>

        <button className="prologue-btn" onClick={onComplete}>{t('prologue.continue')}</button>
      </main>
    </div>
  );
}
