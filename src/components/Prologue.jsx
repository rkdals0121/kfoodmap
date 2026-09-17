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
    if (step === 3) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(s => s + 1);
      setIsTransitioning(false);
    }, 300);
  };

  useEffect(() => {
    if (step === 3) {
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
              {t('prologue.trustLine', { activeCount })}
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

        {/* There is deliberately no location step: the app never requests the
            device's location, so offering an "Allow location" button would be
            a permission prompt that grants nothing. */}
        {step === 3 && (
          <div className="prologue-step prologue-step--center">
            <div className="prologue-spinner"></div>
            <h1 className="prologue-title">{t('prologue.openingTitle')}</h1>
          </div>
        )}
      </div>
    </div>
  );
}
