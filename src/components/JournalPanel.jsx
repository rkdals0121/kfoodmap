import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { restaurants } from '../data/restaurants';
import { isQuarantined, isKnown, VEGAN, dietaryBadges } from '../data/verification';
import { formatShortDate, displayName, getOpenStatus, statusClass, koreanName, DAY_KEYS, formatClock } from '../utils';
import ClaimChip from './ClaimChip';
import { ChevronRightIcon, ShareIcon } from './Icons';
import Seal from './Seal';
import { sealText } from '../data/seal-text';
import { groupByRegion } from '../data/region';
import { sharedListUrl } from '../filters';
import { copyText, shareOrCopy } from '../share';

// A saved place is somewhere you still mean to go, so it is a practical row
// (where, open now, what it offers and how sure we are), not a keepsake.
// Visited places stay stamps.
function SavedRow({ place, savedAt, onOpen, at = null, atLabel = '' }) {
  const { t, i18n } = useTranslation();
  // A plan made on the map ("Open Mon 12:00") holds here: these are the
  // places the plan is about.
  const status = at ? getOpenStatus(place.hours, at, { nameDay: true }) : getOpenStatus(place.hours);
  return (
    <li>
      <button type="button" className="saved-row" onClick={() => onOpen(place)}>
        <span className="saved-row__main">
          <span className="saved-row__name">{displayName(place.name)}</span>
          <span className="saved-row__where">
            {place.zone}
            {savedAt > 0 && <> · {t('journal.savedOn', { date: formatShortDate(savedAt, i18n.language) })}</>}
          </span>
          <span className="saved-row__status">
            {status ? (
              <>{atLabel && <span className="place-card__at">{atLabel}: </span>}<span className={statusClass(status)}>{status.label}</span>{status.detail && <> · {status.detail}</>}</>
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

export default function JournalPanel({ bookmarks, onRestaurantClick, sessionEnded, onGoMap, planAt = null, planDate = null, onShowSaved }) {
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
  const savedGroups = groupByRegion(savedList);
  // The link carries the place ids only (filters.js sharedListUrl).
  const [listShared, setListShared] = useState(false);
  const shareList = async () => {
    const url = sharedListUrl(window.location.origin, savedList.map(s => s.place.id));
    const title = t('journal.shareListTitle');
    const how = await shareOrCopy({ title, url });
    if (how === 'failed') { window.prompt(title, url); return; }
    if (how === 'copied') { setListShared(true); setTimeout(() => setListShared(false), 2500); }
  };

  // The same list as plain text, for a notes app or a chat: the name as
  // written here, the Korean name to paste into Naver or show a driver,
  // the recorded address, and the place's page. Nothing leaves the device
  // but what the person then pastes.
  const [listCopied, setListCopied] = useState(false);
  const copyListText = async () => {
    const lines = savedList.map(({ place }) => [
      // In Korean the shown name is already the Korean one: once, not twice.
      [...new Set([displayName(place.name), koreanName(place.name)].filter(Boolean))].join(' · '),
      isKnown(place.address) ? place.address.value : null,
      `${window.location.origin}/place/${place.id}`,
    ].filter(Boolean).join('\n'));
    const text = lines.join('\n\n');
    const done = () => { setListCopied(true); setTimeout(() => setListCopied(false), 2500); };
    if (await copyText(text)) done(); else window.prompt(t('journal.copyList'), text);
  };

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
            <span className="stat-label">{t('journal.areasCount', { count: neighborhoods.length })}</span>
          </div>
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
                {/* "Visited …" in words: the seal says 방문, which most readers can't. */}
                {visitedAt > 0 && <span className="stamp-date">{t('journal.visitedOn', { date: formatShortDate(visitedAt, i18n.language) })}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {savedList.length > 0 && (
        <div className="journal-section">
          <div className="journal-section-header">
            <h3>{t('journal.savedForLater')}</h3>
            {/* A link to this list, for whoever you are travelling with. */}
            <button type="button" className="journal-share" onClick={shareList}>
              <ShareIcon size={14} />
              {listShared ? t('journal.listCopied') : t('journal.shareList')}
            </button>
          </div>
          {onShowSaved && (
            <button type="button" className="journal-copy" onClick={onShowSaved}>
              {t('journal.showOnMap')}
            </button>
          )}
          <button type="button" className="journal-copy" onClick={copyListText}>
            {listCopied ? t('journal.copyListDone') : t('journal.copyList')}
          </button>
          {/* What saving buys on a trip with patchy data: the pages are kept
              on the phone (usePlaceRecord prefetch). The map's own tiles
              are not, and it says so. */}
          <p className="journal-offline-note">{t('journal.offlineNote')}</p>
          {savedGroups.length > 1 ? (
            // Saved across a trip: one list per region, so the Busan
            // places are together on the day in Busan.
            savedGroups.map(({ region, items }) => (
              <section key={region ?? 'other'} className="saved-group" aria-label={region ?? t('journal.otherRegion')}>
                <h4 className="saved-group__title">
                  {region ?? t('journal.otherRegion')}
                  <span className="saved-group__count"> · {items.length}</span>
                </h4>
                <ul className="saved-list">
                  {items.map(({ place, savedAt }) => (
                    <SavedRow at={planDate} atLabel={planDate && planAt ? t('filters.dayTime', { day: t(`hours.day.${DAY_KEYS[planAt.day]}`), time: formatClock(planAt.minutes) }) : ''} key={place.id} place={place} savedAt={savedAt} onOpen={onRestaurantClick} />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <ul className="saved-list">
              {savedList.map(({ place, savedAt }) => (
                <SavedRow at={planDate} atLabel={planDate && planAt ? t('filters.dayTime', { day: t(`hours.day.${DAY_KEYS[planAt.day]}`), time: formatClock(planAt.minutes) }) : ''} key={place.id} place={place} savedAt={savedAt} onOpen={onRestaurantClick} />
              ))}
            </ul>
          )}
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
          {/* The way out of an empty screen: where saving starts. */}
          {onGoMap && (
            <button type="button" className="journal-empty__cta" onClick={onGoMap}>
              {t('journal.emptyCta')}
            </button>
          )}

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
      {/* Badges after the places: on a short phone they pushed the saved
          list — what the tab is opened for — off the first screen. */}
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

    </section>
  );
}
