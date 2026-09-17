import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from './Icons';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { LEAD_TOPICS, LEAD_LIMITS, buildLead, supabaseConfig, submitLead } from '../data/leads';

const config = supabaseConfig({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

const EMPTY = { name: '', locationHint: '', topic: '', message: '', sourceUrl: '', contactEmail: '', website: '' };

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
export default function SubmitSheet({ place, onClose }) {
  const { t, i18n } = useTranslation();
  const isOnline = useOnlineStatus();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | sent | failed
  const sheetRef = useRef(null);
  const sentRef = useRef(null);

  useEffect(() => {
    sheetRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  useEffect(() => {
    if (status === 'sent') sentRef.current?.focus();
  }, [status]);

  const title = place ? t('submit.titleCorrection') : t('submit.titleNew');
  const set = (key) => (event) => setForm(prev => ({ ...prev, [key]: event.target.value }));
  const describedBy = (id, hasHint) =>
    [hasHint && `${id}-hint`, errors[id] && `${id}-error`].filter(Boolean).join(' ') || undefined;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = buildLead(form, { place, lang: i18n.language });
    // A filled honeypot gets the same success screen and sends nothing —
    // a bot learns nothing from the response.
    if (result.spam) { setStatus('sent'); return; }
    if (!result.ok) { setErrors(result.errors); return; }
    setErrors({});
    setStatus('sending');
    const sent = await submitLead(result.row, config);
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
                    <Field id="submit-name" label={t('submit.nameLabel')} error={errors.name}>
                      <input id="submit-name" value={form.name} onChange={set('name')} maxLength={LEAD_LIMITS.name}
                        aria-invalid={Boolean(errors.name)} aria-describedby={describedBy('submit-name', false)} />
                    </Field>
                    <Field id="submit-location_hint" label={t('submit.locationLabel')} hint={t('submit.locationHint')} error={errors.location_hint}>
                      <input id="submit-location_hint" value={form.locationHint} onChange={set('locationHint')} maxLength={LEAD_LIMITS.location_hint}
                        aria-invalid={Boolean(errors.location_hint)} aria-describedby={describedBy('submit-location_hint', true)} />
                    </Field>
                  </>
                )}

                <Field id="submit-topic" label={t('submit.topicLabel')} error={errors.topic}>
                  <select id="submit-topic" value={form.topic} onChange={set('topic')}
                    aria-invalid={Boolean(errors.topic)} aria-describedby={describedBy('submit-topic', false)}>
                    <option value="" disabled>{t('submit.topicPlaceholder')}</option>
                    {LEAD_TOPICS.map(topic => <option key={topic} value={topic}>{t(`submit.topics.${topic}`)}</option>)}
                  </select>
                </Field>

                <Field id="submit-message" label={t('submit.messageLabel')} error={errors.message}>
                  <textarea id="submit-message" rows={5} value={form.message} onChange={set('message')} maxLength={LEAD_LIMITS.message}
                    aria-invalid={Boolean(errors.message)} aria-describedby={describedBy('submit-message', false)} />
                </Field>

                <Field id="submit-source_url" label={t('submit.sourceLabel')} hint={t('submit.sourceHint')} error={errors.source_url}>
                  <input id="submit-source_url" type="url" inputMode="url" value={form.sourceUrl} onChange={set('sourceUrl')} maxLength={LEAD_LIMITS.source_url}
                    aria-invalid={Boolean(errors.source_url)} aria-describedby={describedBy('submit-source_url', true)} />
                </Field>

                <Field id="submit-contact_email" label={t('submit.emailLabel')} hint={t('submit.emailHint')} error={errors.contact_email}>
                  <input id="submit-contact_email" type="email" autoComplete="email" value={form.contactEmail} onChange={set('contactEmail')} maxLength={LEAD_LIMITS.contact_email}
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
