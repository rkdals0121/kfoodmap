import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheckIcon } from './Icons';
import { restaurants } from '../data/restaurants';
import { isQuarantined } from '../data/verification';
import './Prologue.css';

const activeCount = restaurants.filter(r => !isQuarantined(r)).length;

export default function Prologue({ onComplete }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const nextStep = () => {
    if (step === 4) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(s => s + 1);
      setIsTransitioning(false);
    }, 300);
  };

  useEffect(() => {
    if (step === 4) {
      const timer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [step, onComplete]);

  return (
    <div className="prologue-layout">
      <div className={`prologue-content ${isTransitioning ? 'fade-out' : 'fade-in'}`}>
        
        {step === 1 && (
          <div className="prologue-step">
            <h1 className="prologue-title">{t('prologue.welcomeTitle')}</h1>
            <p className="prologue-subtitle">{t('prologue.welcomeSubtitle')}</p>
            <p className="prologue-trust">
              <ShieldCheckIcon size={16} />
              {t('prologue.trustLine', { count: activeCount })}
            </p>
            <button className="prologue-btn" onClick={nextStep}>{t('prologue.continue')}</button>
          </div>
        )}

        {step === 2 && (
          <div className="prologue-step">
            <h1 className="prologue-title">{t('prologue.storiesTitle')}</h1>
            <p className="prologue-subtitle">{t('prologue.storiesSubtitle')}</p>
            <button className="prologue-btn" onClick={nextStep}>{t('prologue.next')}</button>
          </div>
        )}

        {step === 3 && (
          <div className="prologue-step">
            <div className="prologue-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <h1 className="prologue-title">{t('prologue.locationTitle')}</h1>
            <p className="prologue-subtitle">{t('prologue.locationSubtitle')}</p>
            <button className="prologue-btn" onClick={nextStep}>{t('prologue.allowLocation')}</button>
            <button className="prologue-btn prologue-btn--ghost" onClick={nextStep}>{t('prologue.skipForNow')}</button>
          </div>
        )}

        {step === 4 && (
          <div className="prologue-step prologue-step--center">
            <div className="prologue-spinner"></div>
            <h1 className="prologue-title">{t('prologue.findingTitle')}</h1>
          </div>
        )}
      </div>
    </div>
  );
}
