import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from './Icons';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePlaceSuggestions } from '../hooks/usePlaceSuggestions';
import { LEAD_TOPICS, LEAD_LIMITS, buildLead, supabaseConfig, submitLead } from '../data/leads';

const config = supabaseConfig({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

const NEW_PLACE_TOPICS = ['vegan', 'halal', 'other'];
const EMPTY = { name: '', locationHint: '', topic: '', message: '', sourceUrl: '', contactEmail: '', website: '' };

const ERROR_KEY = { name: 'name', locationHint: 'location_hint', topic: 'topic', message: 'message', sourceUrl: 'source_url', contactEmail: 'contact_email' };
const ERROR_ORDER = ['name', 'location_hint', 'topic', 'message', 'source_url', 'contact_email'];

function Field({ id, label, hint, error, children }) {
  const { t } = useTranslation();
  return (
    <div className="submit-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="submit-field__hint" id={`${id}-hint`}>{hint}</p>}
      {error && (
        <p className="submit-field__error" id={`${id}-error`} role="alert">
          {t(`submit.errors.${error.code}`, { max: error.max })}
        </p>
      )}
    </div>
  );
}

// The sheet for /submit. A correction (place given) never asks for a name
// or location — those are ours already. What's sent is a lead for a person
// to verify, never data, and the success copy says so where the promise is made.
const DRAFTS = new Map();

export default function SubmitSheet({ place, onClose, initialName = '', initialTopic = '' }) {
  const { t, i18n } = useTranslation();
  const isOnline = useOnlineStatus();
  // What has been typed is kept for this visit (in memory only, nothing is
  // stored): closing the sheet to check the map, or a slip of the thumb on
  // a tab, used to throw the whole message away.
  const draftKey = place?.id ?? '';
  const [form, setForm] = useState(() => {
    const kept = DRAFTS.get(draftKey);
    // A name brought from an empty search starts the form, unless one is
    // already being written.
    const written = kept && (kept.message || kept.locationHint || kept.topic || kept.sourceUrl || kept.contactEmail);
    if (initialName && !place && !written) return { ...EMPTY, name: initialName.slice(0, 80) };
    // Reached from the link under the hours: the subject is already chosen.
    const base = kept ?? EMPTY;
    return !base.topic && LEAD_TOPICS.includes(initialTopic) ? { ...base, topic: initialTopic } : base;
  });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | sent | failed
  // Kept until it has been sent.
  useEffect(() => {
    if (status === 'sent') DRAFTS.delete(draftKey); else DRAFTS.set(draftKey, form);
  }, [draftKey, form, status]);
  const [selection, setSelection] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { results } = usePlaceSuggestions(form.name, !place && !selection);
  const sheetRef = useRef(null);
  const sentRef = useRef(null);
  // The sheet's own Escape handler is registered on window in the capture
  // phase (below), so it always runs before any bubble-phase handler on the
  // input — stopPropagation() from the input can never reach it first. A
  // ref mirroring listOpen lets that same window handler decide, at the
  // moment Escape actually fires, whether to close just the list or the
  // whole sheet.
  const listOpenRef = useRef(false);
  // Mirrors the same condition the listbox itself renders under
  // (`listOpen && results.length > 0`) so the window-level Escape handler
  // below agrees with what's actually on screen. Without this, `listOpen`
  // alone goes true on every keystroke even when nothing is rendered yet
  // (no matches, or still inside the 300ms debounce) — Escape would then
  // "close" an invisible list and return without closing the sheet.
  const resultsRef = useRef([]);

  useEffect(() => {
    sheetRef.current?.focus();
  }, []);

  useEffect(() => {
    listOpenRef.current = listOpen;
  }, [listOpen]);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (listOpenRef.current && resultsRef.current.length > 0) {
        setListOpen(false);
        setActiveIndex(-1);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  useEffect(() => {
    if (status === 'sent') sentRef.current?.focus();
  }, [status]);

  // A resolved (debounced) fetch can land after the user has already moved
  // the highlight with the arrow keys; reset rather than let
  // aria-activedescendant point at an option id that no longer exists.
  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  const title = place ? t('submit.titleCorrection') : t('submit.titleNew');
  // Its own tab title while open, as the place and privacy pages have.
  useEffect(() => {
    const before = document.title;
    document.title = `${title} · K-Food Map`;
    return () => { document.title = before; };
  }, [title]);
  // A field being corrected drops its error: the red line used to stay
  // until the next Send, over text that was already right.
  const set = (key) => (event) => {
    setForm(prev => ({ ...prev, [key]: event.target.value }));
    const column = ERROR_KEY[key];
    setErrors(prev => (prev[column] ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== column)) : prev));
  };
  // The errors are keyed by column ("name"), the fields by id
  // ("submit-name"): looked up by id, the error was never announced.
  const describedBy = (id, hasHint) =>
    [hasHint && `${id}-hint`, errors[id.replace('submit-', '')] && `${id}-error`].filter(Boolean).join(' ') || undefined;
  // The keyboard's "next" key: on to the next field. A single-line field's
  // Enter otherwise sends the form — half filled in, from the first box.
  const nextOnEnter = (nextId) => (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (event.keyCode === 229) return;
    document.getElementById(nextId)?.focus();
  };

  const choose = (result) => {
    setSelection(result);
    setForm(prev => ({ ...prev, name: result.name, locationHint: prev.locationHint || result.address }));
    setListOpen(false);
    setActiveIndex(-1);
  };

  const onNameKeyDown = (event) => {
    // An in-progress Hangul composition owns Enter (commits it) and the
    // arrow keys (moves the IME's own candidate selection); intercepting
    // those here would hijack a keystroke meant for the IME instead of the
    // suggestion list.
    if (event.keyCode === 229) return;
    if (event.key === 'ArrowDown' && listOpen && results.length > 0) {
      event.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp' && listOpen && results.length > 0) {
      event.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && listOpen && results.length > 0 && activeIndex >= 0) {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      document.getElementById('submit-location_hint')?.focus();
    }
    // Escape is handled by the sheet's own window listener (list-aware via
    // listOpenRef), which runs first anyway — nothing to do here.
  };

  const onNameBlur = () => {
    setListOpen(false);
    setActiveIndex(-1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = buildLead(form, { place, lang: i18n.language, selection });
    // A filled honeypot gets the same success screen and sends nothing —
    // a bot learns nothing from the response.
    if (result.spam) { setStatus('sent'); return; }
    if (!result.ok) {
      setErrors(result.errors);
      // Send is at the foot of the form and the errors are above it, out of
      // view: go to the first one.
      const first = ERROR_ORDER.find(k => result.errors[k]);
      setTimeout(() => {
        const el = document.getElementById(`submit-${first}`);
        el?.focus({ preventScroll: true });
        el?.scrollIntoView({ block: 'center' });
      }, 0);
      return;
    }
    // The keyboard goes away: "Sending…" and what follows are under it.
    document.activeElement?.blur?.();
    setErrors({});
    setStatus('sending');
    const sent = await submitLead(result.row, config);
    // Here as well as in the effect: a sheet closed while it was sending
    // kept its draft, and reopened it offered to send the same thing again.
    if (sent.ok) DRAFTS.delete(draftKey);
    setStatus(sent.ok ? 'sent' : 'failed');
  };

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-sheet" role="dialog" aria-modal="true" aria-label={title} ref={sheetRef} tabIndex={-1}>
        <button className="detail-close" aria-label={t('submit.close')} onClick={onClose}>
          <XIcon size={18} />
        </button>
        <div className="detail-scroll">
          <div className="detail-content submit-content">
            <h2 className="submit-title">{title}</h2>

            {!config && <p className="submit-note">{t('submit.disabled')}</p>}

            {config && status === 'sent' && (
              <>
                <p className="submit-status" role="status" ref={sentRef} tabIndex={-1}>{t('submit.sent')}</p>
                <button className="btn-primary submit-close" onClick={onClose}>{t('submit.close')}</button>
              </>
            )}

            {config && status !== 'sent' && (
              <form className="submit-form" onSubmit={handleSubmit} noValidate>
                <p className="submit-note">
                  {place ? t('submit.introCorrection', { name: place.name }) : t('submit.introNew')}
                </p>

                {!place && (
                  <>
                    <Field id="submit-name" label={t('submit.nameLabel')} hint={t('submit.suggestionsHint')} error={errors.name}>
                      <input id="submit-name" aria-required="true" value={form.name} enterKeyHint="next" autoComplete="off" autoCorrect="off" spellCheck={false}
                        // Back in the box, the suggestions are back too (they
                        // closed with the keyboard and stayed closed).
                        onFocus={() => { if (!selection && form.name.trim()) setListOpen(true); }}
                        onChange={(event) => { set('name')(event); setSelection(null); setListOpen(true); setActiveIndex(-1); }}
                        onKeyDown={onNameKeyDown}
                        onBlur={onNameBlur}
                        maxLength={LEAD_LIMITS.name}
                        role="combobox"
                        aria-expanded={listOpen && results.length > 0}
                        aria-controls={listOpen && results.length > 0 ? 'submit-name-list' : undefined}
                        aria-autocomplete="list"
                        aria-activedescendant={activeIndex >= 0 ? `submit-name-option-${activeIndex}` : undefined}
                        aria-invalid={Boolean(errors.name)} aria-describedby={describedBy('submit-name', true)} />
                      {listOpen && results.length > 0 && (
                        <ul className="submit-suggestions" role="listbox" id="submit-name-list" aria-label={t('submit.suggestionsLabel')}>
                          {results.map((result, index) => (
                            <li key={result.id}
                                id={`submit-name-option-${index}`}
                                role="option"
                                aria-selected={index === activeIndex}
                                className={`submit-suggestion${index === activeIndex ? ' is-active' : ''}`}
                                onMouseDown={(event) => { event.preventDefault(); choose(result); }}>
                              <span className="submit-suggestion__name">{result.name}</span>
                              <span className="submit-suggestion__meta">{result.address}{result.category ? ` · ${result.category}` : ''}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Field>
                    {selection && (
                      <p className="submit-picked">
                        {t('submit.picked', { address: selection.address })}
                        <button type="button" className="submit-picked__clear" onClick={() => setSelection(null)}>{t('submit.clearPick')}</button>
                      </p>
                    )}
                    <Field id="submit-location_hint" label={t('submit.locationLabel')} hint={t('submit.locationHint')} error={errors.location_hint}>
                      <input id="submit-location_hint" enterKeyHint="next" autoComplete="off" autoCorrect="off" spellCheck={false} value={form.locationHint} onChange={set('locationHint')} onKeyDown={nextOnEnter('submit-topic')} maxLength={LEAD_LIMITS.location_hint}
                        aria-invalid={Boolean(errors.location_hint)} aria-describedby={describedBy('submit-location_hint', true)} />
                    </Field>
                  </>
                )}

                <Field id="submit-topic" label={t(place ? 'submit.topicLabel' : 'submit.topicLabelNew')} error={errors.topic}>
                  <select id="submit-topic" aria-required="true" value={form.topic} onChange={set('topic')}
                    aria-invalid={Boolean(errors.topic)} aria-describedby={describedBy('submit-topic', false)}>
                    <option value="" disabled>{t('submit.topicPlaceholder')}</option>
                    {/* A new place has no hours or address on the map to be wrong
                        about: offer what a suggestion can be about. A report
                        on a listed place keeps every topic. */}
                    {LEAD_TOPICS.filter(topic => place || NEW_PLACE_TOPICS.includes(topic)).map(topic => <option key={topic} value={topic}>{t(`submit.topics.${topic}`)}</option>)}
                  </select>
                </Field>

                <Field id="submit-message" label={t(place ? 'submit.messageLabel' : 'submit.messageLabelNew')} error={errors.message}>
                  <textarea id="submit-message" aria-required="true" rows={5} value={form.message} onChange={set('message')} maxLength={LEAD_LIMITS.message}
                    aria-invalid={Boolean(errors.message)} aria-describedby={describedBy('submit-message', false)} />
                </Field>

                <Field id="submit-source_url" label={t('submit.sourceLabel')} hint={t('submit.sourceHint')} error={errors.source_url}>
                  <input id="submit-source_url" type="url" inputMode="url" enterKeyHint="next" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={form.sourceUrl} onChange={set('sourceUrl')} onKeyDown={nextOnEnter('submit-contact_email')}
                    aria-invalid={Boolean(errors.source_url)} aria-describedby={describedBy('submit-source_url', true)} />
                </Field>

                <Field id="submit-contact_email" label={t('submit.emailLabel')} hint={t('submit.emailHint')} error={errors.contact_email}>
                  <input id="submit-contact_email" type="email" inputMode="email" autoComplete="email" enterKeyHint="send" autoCapitalize="none" value={form.contactEmail} onChange={set('contactEmail')} maxLength={LEAD_LIMITS.contact_email}
                    aria-invalid={Boolean(errors.contact_email)} aria-describedby={describedBy('submit-contact_email', true)} />
                </Field>

                {/* A new tab, not an in-app route: navigating this sheet away
                    would discard what the user has typed. */}
                <a className="submit-privacy-link" href="/privacy" target="_blank" rel="noopener">
                  {t('submit.privacyLink')}
                </a>

                <div className="submit-honeypot" aria-hidden="true">
                  <label htmlFor="submit-hp">Leave this empty</label>
                  <input id="submit-hp" name="hp" tabIndex={-1} autoComplete="new-password" value={form.website} onChange={set('website')} />
                </div>

                {!isOnline && <p className="submit-status submit-status--error" role="status">{t('submit.offline')}</p>}
                {isOnline && status === 'failed' && <p className="submit-status submit-status--error" role="alert">{t('submit.failed')}</p>}

                <button className="btn-primary" type="submit" disabled={!isOnline || status === 'sending'}>
                  {status === 'sending' ? t('submit.sending') : t('submit.send')}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
