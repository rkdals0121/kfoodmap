import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { restaurants } from '../data/restaurants';
import { isQuarantined, isKnown, VEGAN, dietaryBadges } from '../data/verification';
import { formatShortDate, displayName, getOpenStatus } from '../utils';
import ClaimChip from './ClaimChip';
import { ChevronRightIcon } from './Icons';
import Seal from './Seal';
import { sealText } from '../data/seal-text';

// A saved place is somewhere you still mean to go, so it is a practical row
// (where, open now, what it offers and how sure we are), not a keepsake.
// Visited places stay stamps.
function SavedRow({ place, savedAt, onOpen }) {
  const { t, i18n } = useTranslation();
  const status = getOpenStatus(place.hours);
  return (
    <li>
      <button type="button" className="saved-row" onClick={() => onOpen(place)}>
        <span className="saved-row__main">
          <span className="saved-row__name">{displayName(place.name)}</span>
          <span className="saved-row__where">
            {place.zone}
            {savedAt && <> · {t('journal.savedOn', { date: formatShortDate(savedAt, i18n.language) })}</>}
          </span>
          <span className="saved-row__status">
            {status ? (
              <><span className={status.open ? 'is-open' : 'is-closed'}>{status.label}</span>{status.detail && <> · {status.detail}</>}</>
            ) : (
              <span className="place-card__unknown">{t('list.hoursUnknown')}</span>
            )}
          </span>
          <span className="saved-row__claims">
            {dietaryBadges(place).map(b => <ClaimChip key={b.key} kind={b.key} label={b.label} fact={b.fact} />)}
          </span>
        </span>
        <ChevronRightIcon size={18} />
      </button>
    </li>
  );
}

// A small, fixed sample for the empty-passport preview — not the user's own
// data, so every stamp below carries a "Sample" label instead of a date and
// is filtered through isQuarantined, same as everywhere else a restaurant is
// shown, in case one of these three is ever quarantined later.
const SAMPLE_IDS = ['gonghwachun', 'kampungku', 'plant-cafe'];

export default function JournalPanel({ bookmarks, onRestaurantClick, sessionEnded }) {
  const { t, i18n } = useTranslation();
  const byId = useMemo(() => Object.fromEntries(restaurants.map(r => [r.id, r])), []);

  const samples = useMemo(
    () => SAMPLE_IDS.map(id => byId[id]).filter(place => place && !isQuarantined(place)),
    [byId],
  );

  const stamped = useMemo(() =>
    bookmarks
      .map(b => ({ ...b, place: byId[b.id] }))
      .filter(b => b.place && !isQuarantined(b.place))
      .sort((a, b) => (a.savedAt ?? 0) - (b.savedAt ?? 0)),
  [bookmarks, byId]);

  const visitedList = stamped.filter(s => s.visitedAt != null);
  const savedList = stamped.filter(s => s.visitedAt == null);

  const neighborhoods = useMemo(() => {
    const zones = new Set(visitedList.map(s => s.place.zone));
    return Array.from(zones);
  }, [visitedList]);

  const badges = [
    // Seal words: 첫맛 "first taste", 채식 "plant-based eating".
    { key: 'first-taste', seal: { chars: ['첫', '맛'], cols: 2 }, name: t('journal.firstTaste'), earned: visitedList.length > 0 },
    {
      key: 'plant-based',
      seal: { chars: ['채', '식'], cols: 2 },
      name: t('journal.plantBased'),
      earned: visitedList.some(({ place }) => isKnown(place.dietary?.vegan) && place.dietary.vegan.value === VEGAN.FULL),
    },
  ];
  const earnedCount = badges.filter(b => b.earned).length;

  return (
    <section className="journal-panel" aria-label={t('journal.ariaLabel')}>
      <div className="passport-cover">
        <h2 className="passport-cover__title">{t('journal.title')}</h2>
        <div className="passport-stats">
          <div className="stat-box">
            <span className="stat-num">{visitedList.length}</span>
            <span className="stat-label">{t('journal.visited')}</span>
          </div>
          <div className="stat-box">
            <span className="stat-num">{savedList.length}</span>
            {/* Saved-but-not-visited. Profile's "Saved" counts every saved
                place, visited or not, so this one needs its own name. */}
            <span className="stat-label">{t('journal.toVisit')}</span>
          </div>
          <div className="stat-box">
            <span className="stat-num">{neighborhoods.length}</span>
            <span className="stat-label">{t('journal.areas')}</span>
          </div>
        </div>
      </div>

      <div className="journal-section">
        <div className="journal-section-header">
          <h3>{t('journal.badges')}</h3>
          <span className="journal-badge-count">{t('journal.badgesEarned', { count: earnedCount })}</span>
        </div>
        <div className="badges-grid">
          {badges.map(badge => (
            <div key={badge.key} className={`badge-item ${badge.earned ? 'earned' : 'locked'}`}>
              <Seal {...badge.seal} earned={badge.earned} size="sm" />
              <span className="badge-name">{badge.name}</span>
            </div>
          ))}
        </div>
      </div>

      {visitedList.length > 0 && (
        <div className="journal-section">
          <div className="journal-section-header">
            <h3>{t('journal.visitedPlaces')}</h3>
          </div>
          <div className="journal-grid">
            {visitedList.map(({ place, visitedAt }) => (
              <button
                key={place.id}
                className="stamp"
                onClick={() => onRestaurantClick(place)}
              >
                <Seal {...sealText(place.name)} />
                <span className="stamp-name">{displayName(place.name)}</span>
                <span className="stamp-zone">{place.zone}</span>
                {visitedAt && <span className="stamp-date">{formatShortDate(visitedAt, i18n.language)}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {savedList.length > 0 && (
        <div className="journal-section">
          <div className="journal-section-header">
            <h3>{t('journal.savedForLater')}</h3>
          </div>
          <ul className="saved-list">
            {savedList.map(({ place, savedAt }) => (
              <SavedRow key={place.id} place={place} savedAt={savedAt} onOpen={onRestaurantClick} />
            ))}
          </ul>
        </div>
      )}

      {stamped.length === 0 && (
        <div className="journal-empty">
          {/* This is the one place a person whose session just ended on its
              own -- an expired or revoked token, or a sign-out in another
              tab -- actually sees the empty Journal it caused. The same
              explanation already exists in ProfileTab (src/components/
              TabPanel.jsx), reached via the Profile tab, but nothing sends
              someone there: they land here first. Reusing profile.sessionEnded
              rather than adding a second wording of the same sentence --
              the situation is identical, only the surface differs. */}
          {sessionEnded && (
            <p className="journal-empty__notice" role="status">
              <span aria-hidden="true">⚠️</span> {t('profile.sessionEnded')}
            </p>
          )}
          {/* An uncut seal: 여권, "passport". */}
          <Seal chars={['여', '권']} cols={2} earned={false} size="sm" />
          <p className="journal-empty__title">{t('journal.emptyTitle')}</p>
          <p className="journal-empty__body">
            {t('journal.emptyBody')}
          </p>

          {samples.length > 0 && (
            <>
              <p className="journal-sample-label">{t('journal.whatItllLookLike')}</p>
              <div className="journal-grid journal-grid--sample">
                {samples.map(place => (
                  <button
                    key={place.id}
                    className="stamp"
                    onClick={() => onRestaurantClick(place)}
                  >
                    <Seal {...sealText(place.name)} />
                    <span className="stamp-name">{displayName(place.name)}</span>
                    <span className="stamp-zone">{place.zone}</span>
                    <span className="stamp-sample-tag">{t('journal.sample')}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="journal-empty__steps">
            <div className="journal-empty__step">
              <span className="journal-empty__step-num">1</span>
              {t('journal.step1')}
            </div>
            <div className="journal-empty__step">
              <span className="journal-empty__step-num">2</span>
              {t('journal.step2')}
            </div>
            <div className="journal-empty__step">
              <span className="journal-empty__step-num">3</span>
              {t('journal.step3')}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
