import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from './Icons';
import { privacyPolicy, PRIVACY_CONTACT } from '../data/privacy';

// The policy is written in English and Korean (data/privacy.js), kept in step
// by scripts/tests/privacy.test.mjs. Readers of the app's other languages
// get a translation for convenience, fetched when the page opens and shown
// first, with a line saying the English and Korean texts are the ones that
// count. If it cannot be fetched, the note alone says which languages the
// policy is in.
const TRANSLATIONS = {
  ja: () => import('../data/privacy.ja.js'),
  'zh-Hans': () => import('../data/privacy.zh-Hans.js'),
  'zh-Hant': () => import('../data/privacy.zh-Hant.js'),
  id: () => import('../data/privacy.id.js'),
};

function PolicyVersion({ lang, policy }) {
  return (
    <section className="privacy-version" lang={lang}>
      <h2 className="submit-title">{policy.title}</h2>
      <p className="privacy-effective">{policy.effective}</p>
      {policy.translationNote && <p className="section-note privacy-language-note">{policy.translationNote}</p>}
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
  const { t, i18n } = useTranslation();
  const sheetRef = useRef(null);

  useEffect(() => {
    const before = document.title;
    document.title = `${t('profile.privacyPolicy')} · K-Food Map`;
    return () => { document.title = before; };
  }, [t]);

  // The reader's own language, when the policy has been translated into it.
  const [translated, setTranslated] = useState(null);
  useEffect(() => {
    const loader = TRANSLATIONS[i18n.language];
    setTranslated(null);
    if (!loader) return undefined;
    let live = true;
    loader().then(mod => { if (live) setTranslated({ lang: i18n.language, policy: mod.default }); }).catch(() => {});
    return () => { live = false; };
  }, [i18n.language]);

  // Focus in, and back to what opened the sheet (Profile's Privacy row) on close.
  useEffect(() => {
    const opener = document.activeElement;
    sheetRef.current?.focus();
    return () => {
      if (opener && opener !== document.body && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-sheet" role="dialog" aria-modal="true" aria-label={t('profile.privacyPolicy')} ref={sheetRef} tabIndex={-1}>
        <button className="detail-close" aria-label={t('submit.close')} onClick={onClose}>
          <XIcon size={18} />
        </button>
        <div className="detail-scroll">
          <div className="detail-content submit-content privacy-content">
            {/* The policy is a legal text and is kept in the two languages it
                was written in; a reader of another language is told so. */}
            {translated?.lang === i18n.language
              ? <PolicyVersion lang={document.documentElement.lang || i18n.language} policy={translated.policy} />
              : !['en', 'ko'].includes(i18n.language) && (
                <p className="section-note privacy-language-note">{t('profile.privacyLanguageNote')}</p>
              )}
            {/* One version open — the reader's — and the others folded under
                their own names. All of them in full was fifteen screens on
                a phone (three policies, for a reader of a translation); the
                two it was written in are still one tap away. */}
            {['en', 'ko']
              .sort((a, b) => (b === i18n.language) - (a === i18n.language))
              .map((lang, i) => (
                (i === 0 && translated?.lang !== i18n.language)
                  ? <PolicyVersion key={lang} lang={lang} policy={privacyPolicy[lang]} />
                  : (
                    <details key={lang} className="privacy-other">
                      <summary lang={lang}>{lang === 'ko' ? '한국어 전문' : 'English (full text)'}</summary>
                      <PolicyVersion lang={lang} policy={privacyPolicy[lang]} />
                    </details>
                  )
              ))}
          </div>
        </div>
      </div>
    </>
  );
}
