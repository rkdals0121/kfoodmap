import React, { useEffect, useRef, useState } from 'react';
import { useInertRoot } from '../hooks/useOverlay';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useBackToClose } from '../hooks/useOverlay';
import { registerConfirmHost } from '../confirm';

// A question before something is removed, asked by the app in the reader's
// language. window.confirm() said "kfoodmap.vercel.app says…" over buttons
// in the phone's language, not the app's, and some in-app browsers answer
// it "no" without showing it — so a visit could not be taken back there.
//
// Asked through askConfirm() in src/confirm.js; this host is rendered once
// by App and shows one question at a time.
export default function ConfirmHost() {
  const { t } = useTranslation();
  const [question, setQuestion] = useState(null);
  const yesRef = useRef(null);
  const noRef = useRef(null);
  useInertRoot(Boolean(question));

  useEffect(() => {
    return registerConfirmHost((message, options) => new Promise((resolve) => {
      setQuestion(prev => { prev?.resolve(false); return { message, options, resolve }; });
    }));
  }, []);

  const answer = (value) => {
    setQuestion((q) => { q?.resolve(value); return null; });
  };
  // Back, Escape and a tap outside all mean "no".
  useBackToClose(question !== null, () => answer(false));
  useEffect(() => {
    if (!question) return undefined;
    // Focus comes back to whatever asked, when the question is answered.
    const opener = document.activeElement;
    // On the safe answer: these questions are about removing something.
    (noRef.current ?? yesRef.current)?.focus();
    const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); answer(false); } };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (opener && document.contains(opener)) opener.focus?.({ preventScroll: true });
    };
  }, [question]);

  if (!question) return null;
  return createPortal(
    <div className="confirm-overlay" onClick={() => answer(false)}>
      <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-message" onClick={(e) => e.stopPropagation()}>
        <p id="confirm-message" className="confirm__message">{question.message}</p>
        <div className="confirm__actions">
          <button type="button" className="confirm__btn" ref={noRef} onClick={() => answer(false)}>{t('app.cancel')}</button>
          <button type="button" className="confirm__btn confirm__btn--yes" ref={yesRef} onClick={() => answer(true)}>
            {question.options.confirmLabel ?? t('app.ok')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
