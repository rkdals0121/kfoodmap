import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from './Icons';
import { STAFF_CARDS, STAFF_ANSWERS, MENU_WORDS, cardById } from '../data/staff-cards';

// The sheet for /cards: Korean text to show restaurant staff
// (data/staff-cards.js). Two jobs on one screen:
//  - the visitor reads, in English, exactly what each line says;
//  - staff read the Korean, which "Show large" puts on the whole screen at a
//    size readable across a counter, with nothing else on it.
// Works offline: everything here ships in the bundle.
export default function StaffCardSheet({ initialCard, onClose, onCardChange }) {
  const { t } = useTranslation();
  const sheetRef = useRef(null);
  const [cardId, setCardId] = useState(() => cardById(initialCard).id);
  // What is on the big screen: an array of Korean lines, or null.
  const [large, setLarge] = useState(null);
  const largeRef = useRef(null);
  // What opened the big screen, to give focus back when it closes.
  const largeOpener = useRef(null);
  const openLarge = (lines) => { largeOpener.current = document.activeElement; setLarge(lines); };
  const closeLarge = () => {
    setLarge(null);
    const opener = largeOpener.current;
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  };
  // The address follows the card, so a reload or a shared link shows the
  // same one.
  const chooseCard = (id) => { setCardId(id); onCardChange?.(id); };

  // The tab title names the page, as place pages do.
  useEffect(() => {
    const before = document.title;
    document.title = `${t('cards.title')} · K-Food Map`;
    return () => { document.title = before; };
  }, [t]);
  const card = cardById(cardId);

  useEffect(() => {
    const opener = document.activeElement;
    sheetRef.current?.focus();
    return () => {
      if (opener && opener !== document.body && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

  // Escape closes the big screen first, then the sheet.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (large) closeLarge(); else onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, large]);

  useEffect(() => { if (large) largeRef.current?.focus(); }, [large]);

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-sheet" role="dialog" aria-modal="true" aria-label={t('cards.title')} ref={sheetRef} tabIndex={-1}>
        <button className="detail-close" aria-label={t('submit.close')} onClick={onClose}>
          <XIcon size={18} />
        </button>
        <div className="detail-scroll">
          <div className="detail-content submit-content staff-cards">
            <h2 className="submit-title">{t('cards.title')}</h2>
            <p className="staff-cards__intro">{t('cards.intro')}</p>

            <div className="staff-cards__tabs" role="group" aria-label={t('cards.chooseCard')}>
              {STAFF_CARDS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip${c.id === cardId ? ' active' : ''}`}
                  aria-pressed={c.id === cardId}
                  onClick={() => chooseCard(c.id)}
                >
                  {t(c.labelKey)}
                </button>
              ))}
            </div>

            <section className="staff-card" aria-label={t('cards.showThis')}>
              <h3 className="staff-cards__heading">{t('cards.showThis')}</h3>
              <div className="staff-card__paper">
                {card.statement.map(line => (
                  <p key={line.ko} className="staff-card__ko" lang="ko">{line.ko}</p>
                ))}
              </div>
              <button type="button" className="staff-card__large-btn" onClick={() => openLarge(card.statement.map(l => l.ko))}>
                {t('cards.showLarge')}
              </button>
              <details className="staff-card__meaning" open>
                <summary>{t('cards.whatItSays')}</summary>
                <ul>
                  {card.statement.map(line => <li key={line.ko}>{line.en}</li>)}
                </ul>
              </details>
            </section>

            <section>
              <h3 className="staff-cards__heading">{t('cards.questions')}</h3>
              <p className="staff-cards__hint">{t('cards.questionsHint')}</p>
              <ul className="staff-questions">
                {card.questions.map(q => (
                  <li key={q.ko}>
                    <button type="button" className="staff-question" onClick={() => openLarge([q.ko])}>
                      <span className="staff-question__en">{q.en}</span>
                      <span className="staff-question__ko" lang="ko">{q.ko}</span>
                      <span className="staff-question__roman">{q.roman}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="staff-cards__heading">{t('cards.answers')}</h3>
              <p className="staff-cards__hint">{t('cards.answersHint')}</p>
              <dl className="staff-words">
                {STAFF_ANSWERS.map(a => (
                  <div key={a.ko}>
                    <dt><span lang="ko">{a.ko}</span> <span className="staff-words__roman">{a.roman}</span></dt>
                    <dd>{a.en}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <h3 className="staff-cards__heading">{t('cards.menuWords')}</h3>
              <p className="staff-cards__hint">{t('cards.menuWordsHint')}</p>
              <dl className="staff-words">
                {MENU_WORDS.map(w => (
                  <div key={w.ko}>
                    <dt><span lang="ko">{w.ko}</span> <span className="staff-words__roman">{w.roman}</span></dt>
                    <dd>{w.en}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <p className="section-note staff-cards__note">{t('cards.note')}</p>
          </div>
        </div>
      </div>

      {large && (
        <button
          type="button"
          className="staff-large"
          ref={largeRef}
          onClick={closeLarge}
        >
          <span className="staff-large__text" lang="ko">
            {large.map(line => <span key={line}>{line}</span>)}
          </span>
          <span className="staff-large__close">{t('cards.tapToClose')}</span>
        </button>
      )}
    </>
  );
}
