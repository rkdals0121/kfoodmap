import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBackToClose, useWakeLock, useFitText, useInertRoot, focusAfterOverlay, useReturnFocus } from '../hooks/useOverlay';
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
  const { t, i18n } = useTranslation();
  // A Korean reader needs no gloss of the Korean: the meaning lines would
  // repeat the sentence above them.
  const gloss = i18n.language !== 'ko';
  const sheetRef = useRef(null);
  const [cardId, setCardId] = useState(() => cardById(initialCard).id);
  // What is on the big screen: an array of Korean lines, or null.
  const [large, setLarge] = useState(null);
  const largeRef = useRef(null);
  // What opened the big screen, to give focus back when it closes.
  const largeOpener = useRef(null);
  // What the sentence says, in the reader's language, small under the
  // Korean: holding the phone out, they could not tell which question was up.
  const [largeMeaning, setLargeMeaning] = useState('');
  const openLarge = (lines, meaning = '') => { largeOpener.current = document.activeElement; setLargeMeaning(meaning); setLarge(lines); };
  const closeLarge = () => {
    setLarge(null);
    const opener = largeOpener.current;
    if (opener && document.contains(opener)) focusAfterOverlay(opener);
  };
  useBackToClose(large !== null, closeLarge);
  useWakeLock(large !== null);
  const largeText = useRef(null);
  useFitText(largeText, large !== null, { min: 22, max: 120 });
  useInertRoot(large !== null);
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

  // Focus goes back to what opened the cards — or to its twin: the link on
  // a place is drawn again when the place comes back under the closing
  // cards, and focus was left on the place as a whole.
  useReturnFocus();
  useEffect(() => { sheetRef.current?.focus(); }, []);

  // Escape closes the big screen first, then the sheet.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || document.querySelector('.confirm-overlay')) return;
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
              {/* The button before the card: under it, it was below the first
                  screen of a shorter phone. Tapping the card does the same. */}
              <button type="button" className="staff-card__large-btn" onClick={() => openLarge(card.statement.map(l => l.ko))}>
                {t('cards.showLarge')}
              </button>
              <div className="staff-card__paper" onClick={() => openLarge(card.statement.map(l => l.ko))}>
                {card.statement.map(line => (
                  <p key={line.ko} className="staff-card__ko" lang="ko" translate="no">{line.ko}</p>
                ))}
              </div>
              {gloss && <details className="staff-card__meaning" open>
                <summary>{t('cards.whatItSays')}</summary>
                <ul>
                  {card.statement.map(line => <li key={line.ko}>{t(`cardText.${line.key}`)}</li>)}
                </ul>
              </details>}
            </section>

            {/* Why a card, after the card: above it, it pushed the card and its
                button below the first screen of a shorter phone. */}
            <p className="staff-cards__intro">{t('cards.intro')}</p>

            <section>
              <h3 className="staff-cards__heading">{t('cards.questions')}</h3>
              <p className="staff-cards__hint">{t('cards.questionsHint')}</p>
              <ul className="staff-questions">
                {card.questions.map(q => (
                  <li key={q.ko}>
                    <button type="button" className="staff-question" onClick={() => openLarge([q.ko], gloss ? t(`cardText.${q.key}`) : '')}>
                      {gloss && <span className="staff-question__en">{t(`cardText.${q.key}`)}</span>}
                      <span className="staff-question__ko" lang="ko" translate="no">{q.ko}</span>
                      {/* How it sounds, for a reader who cannot read Hangul — not for one who can. */}
                      {gloss && <span className="staff-question__roman" translate="no">{q.roman}</span>}
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
                    <dt><span lang="ko" translate="no">{a.ko}</span>{gloss && <> <span className="staff-words__roman" translate="no">{a.roman}</span></>}</dt>
                    {/* ("네 — 그렇다", "돼지고기 — 돼지의 고기": no gloss of Korean for a reader of Korean.) */}
                    {gloss && <dd>{t(`cardText.${a.key}`)}</dd>}
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <h3 className="staff-cards__heading">{t('cards.menuWords')}</h3>
              <p className="staff-cards__hint">{t('cards.menuWordsHint')}</p>
              <dl className="staff-words">
                {MENU_WORDS.filter(w => !w.only || w.only === cardId).map(w => (
                  <div key={w.ko}>
                    <dt><span lang="ko" translate="no">{w.ko}</span>{gloss && <> <span className="staff-words__roman" translate="no">{w.roman}</span></>}</dt>
                    {gloss && <dd>{t(`cardText.${w.key}`)}</dd>}
                  </div>
                ))}
              </dl>
            </section>

            <p className="section-note staff-cards__note">{t('cards.note')}</p>
          </div>
        </div>
      </div>

      {/* On <body>, with the app behind it inert, like the large name. */}
      {large && createPortal(
        <button
          type="button"
          className="staff-large"
          ref={largeRef}
          onClick={closeLarge}
          // The only control on the screen: Tab stays on it rather than
          // moving to the sheet hidden behind.
          onKeyDown={(e) => { if (e.key === 'Tab') e.preventDefault(); }}
        >
          <span className="staff-large__text" lang="ko" translate="no" ref={largeText}>
            {large.map(line => <span key={line}>{line}</span>)}
          </span>
          {largeMeaning && <span className="staff-large__meaning">{largeMeaning}</span>}
          <span className="staff-large__close">{t('cards.tapToClose')}</span>
        </button>,
        document.body,
      )}
    </>
  );
}
