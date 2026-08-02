import React, { useState, useEffect } from 'react';
import './Prologue.css';

export default function Prologue({ onComplete }) {
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
            <h1 className="prologue-title">Welcome to Korea.</h1>
            <p className="prologue-subtitle">Discover food that matches your taste.</p>
            <button className="prologue-btn" onClick={nextStep}>Continue</button>
          </div>
        )}

        {step === 2 && (
          <div className="prologue-step">
            <h1 className="prologue-title">Explore Korean food stories.</h1>
            <p className="prologue-subtitle">Every restaurant has a cultural story.</p>
            <button className="prologue-btn" onClick={nextStep}>Next</button>
          </div>
        )}

        {step === 3 && (
          <div className="prologue-step">
            <div className="prologue-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <h1 className="prologue-title">Allow location</h1>
            <p className="prologue-subtitle">To find the best places near you.</p>
            <button className="prologue-btn" onClick={nextStep}>Allow While Using App</button>
            <button className="prologue-btn prologue-btn--ghost" onClick={nextStep}>Skip for now</button>
          </div>
        )}

        {step === 4 && (
          <div className="prologue-step prologue-step--center">
            <div className="prologue-spinner"></div>
            <h1 className="prologue-title">Finding restaurants near you...</h1>
          </div>
        )}
      </div>
    </div>
  );
}
