import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from './Icons';
import { privacyPolicy, PRIVACY_CONTACT } from '../data/privacy';

function PolicyVersion({ lang, policy }) {
  return (
    <section className="privacy-version" lang={lang}>
      <h2 className="submit-title">{policy.title}</h2>
      <p className="privacy-effective">{policy.effective}</p>
      {policy.sections.map(section => (
        <div className="privacy-section" key={section.heading}>
          <h3>{section.heading}</h3>
          {section.text && <p>{section.text}</p>}
          {section.items && (
            <ul>
              {section.items.map(item => <li key={item}>{item}</li>)}
            </ul>
          )}
        </div>
      ))}
      <p className="privacy-contact">
        {PRIVACY_CONTACT
          ? <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>
          : policy.contactPending}
      </p>
    </section>
  );
}

// The sheet for /privacy. Both languages are shown in full, one after the
// other: the readers are visitors from abroad, the operator is in Korea.
export default function PrivacySheet({ onClose }) {
  const { t } = useTranslation();
  const sheetRef = useRef(null);

  useEffect(() => {
    sheetRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-sheet" role="dialog" aria-modal="true" aria-label={privacyPolicy.en.title} ref={sheetRef} tabIndex={-1}>
        <button className="detail-close" aria-label={t('submit.close')} onClick={onClose}>
          <XIcon size={18} />
        </button>
        <div className="detail-scroll">
          <div className="detail-content submit-content privacy-content">
            <PolicyVersion lang="en" policy={privacyPolicy.en} />
            <PolicyVersion lang="ko" policy={privacyPolicy.ko} />
          </div>
        </div>
      </div>
    </>
  );
}
