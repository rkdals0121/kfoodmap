import { useEffect, useLayoutEffect, useRef } from 'react';

// Things that open over a screen without an address of their own — the
// language picker, the Korean text shown large, the About dialog.
//
// useBackToClose: on a phone, Back means "close what I just opened". These
// were plain state, so Back closed the screen underneath instead (the whole
// place page, when only the large Korean name was meant). While `open`, one
// history entry stands for the overlay: Back pops it and closes the
// overlay; closing it any other way takes the entry out again. The entry
// repeats the current address and router state, so nothing navigates.
export function useBackToClose(open, close) {
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });
  useEffect(() => {
    if (!open) return undefined;
    // The entry is marked, so that closing by a button only steps back when
    // that entry is still the one on top — not after a navigation replaced
    // or buried it, when a back() would undo the navigation instead.
    const mark = `${Date.now()}-${Math.random()}`;
    window.history.pushState({ ...window.history.state, kfmOverlay: mark }, '');
    let popped = false;
    const onPop = () => {
      if (window.history.state?.kfmOverlay === mark) return;   // a pop that landed on it, not off it
      popped = true;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (!popped && window.history.state?.kfmOverlay === mark) window.history.back();
    };
  }, [open]);
}

// useWakeLock: the screen stays on while a card is held out to restaurant
// staff. Without it the phone dimmed or locked in the other person's hand.
// Where the browser has no wake lock (or refuses: low battery), nothing
// happens — the card is still there. Taken again when the tab comes back,
// because the browser drops the lock whenever the page is hidden.
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.wakeLock) return undefined;
    let lock = null;
    let gone = false;
    const take = async () => {
      try {
        const got = await navigator.wakeLock.request('screen');
        if (gone) got.release().catch(() => {});
        else lock = got;
      } catch {
        // not allowed right now: carry on without it
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') take(); };
    take();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      gone = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

// useFitText: Korean held out to someone across a counter should be as big
// as the screen allows. A fixed size made "Show large" 24 px on a phone —
// a quarter larger than the card it came from, on a third of the screen.
// While `active`, the element's font size is the largest (between `min` and
// `max`) at which it still fits its parent, less what the parent's other
// children take; measured again when the screen turns.
export function useFitText(ref, active, { min = 22, max = 160 } = {}) {
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!active || !el || !box) return undefined;
    const fit = () => {
      const style = getComputedStyle(box);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const gap = parseFloat(style.rowGap) || 0;
      let others = 0;
      for (const child of box.children) if (child !== el) others += child.offsetHeight + gap;
      const room = box.clientHeight - padY - others;
      let lo = min;
      let hi = typeof max === 'function' ? max() : max;
      // Binary search: 8 steps settle within a pixel.
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        el.style.fontSize = `${mid}px`;
        if (el.offsetHeight <= room && el.scrollWidth <= el.clientWidth + 1) lo = mid; else hi = mid;
      }
      el.style.fontSize = `${Math.floor(lo)}px`;
    };
    fit();
    // The bold Korean face may arrive after the first measure.
    document.fonts?.ready?.then(() => { if (el.isConnected) fit(); });
    // …and whenever a face finishes loading later: the typeface's own
    // stylesheet now arrives after the first paint (main.jsx), so `ready`
    // can resolve before the face is even asked for.
    const refit = () => { if (el.isConnected) fit(); };
    document.fonts?.addEventListener?.('loadingdone', refit);
    window.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      document.fonts?.removeEventListener?.('loadingdone', refit);
    };
    // A function for `max` is read at each fit and is not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, active, min, typeof max === 'function' ? 0 : max]);
}

// While an overlay rendered on <body> is open, the app behind it is inert:
// Tab was already held, but a screen reader's swipe walked on into the page
// the overlay covers. Counted, so one overlay over another (a confirmation
// over a sheet) releases the app only when the last one closes.
let inertCount = 0;
// The last thing focused inside the app: an overlay's opener. A closing
// overlay hands focus back to it, but while the app is still inert that
// focus() does nothing and focus fell to <body>; it is given again here,
// once the app can take it.
let lastInApp = null;
// The element a closing overlay asked to hand focus to. Asked while the app
// is still inert (focus() is ignored then), honoured when it is released.
let wanted = null;
// What had focus in the app last: an overlay that mounts after the app has
// gone inert finds document.activeElement already on <body>.
export const lastFocusInApp = () => lastInApp;
// The same control after its part of the app has been drawn again. A place
// opened from the Journal, from Discover or from Profile takes that tab
// off the page; closed, the tab is back, but as new elements — the row
// that was pressed is gone and its twin is there. Told apart by what kind
// of thing it is (its first class) and the words on it; an id where it
// has one.
export function markOf(el) {
  if (!el || typeof document === 'undefined') return null;
  if (el.id) return { id: el.id };
  const kind = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '';
  if (!kind) return null;
  return { kind, classes: el.className, words: (el.textContent ?? '').slice(0, 80), nth: [...document.getElementsByClassName(kind)].indexOf(el) };
}
export function findByMark(mark) {
  if (!mark || typeof document === 'undefined') return null;
  if (mark.id) return document.getElementById(mark.id);
  const said = [...document.getElementsByClassName(mark.kind)].filter(el => (el.textContent ?? '').slice(0, 80) === mark.words);
  // Two with the same words: the one of the same make (the two "Report
  // incorrect info" links of a place differ by a class), then the one in
  // the same position (a place in two journeys), if it is among them.
  const same = said.filter(el => el.className === mark.classes);
  const all = same.length > 0 ? same : said;
  return all.find(el => [...document.getElementsByClassName(mark.kind)].indexOf(el) === mark.nth) ?? all[0] ?? null;
}
let lastMark = null;
export function focusAfterOverlay(el) {
  // Only while the app is inert: otherwise the focus() below simply works,
  // and a stale request would be honoured when some later overlay closed.
  wanted = document.getElementById('root')?.inert ? (el ?? null) : null;
  el?.focus?.({ preventScroll: true });
}
if (typeof document !== 'undefined') {
  document.addEventListener('focusin', (e) => {
    if (document.getElementById('root')?.contains(e.target)) { lastInApp = e.target; lastMark = markOf(e.target); }
  }, true);
  // Focus that leaves for nowhere (a tap on plain content; Safari, where a
  // tapped button takes no focus) is not an opener to return to — the
  // search box focused a minute ago would otherwise be given focus, and
  // open the keyboard, when a confirmation closes.
  // Told by the press that took it: focus also leaves with no press at
  // all, when the part of the app it is in goes inert or out of sight
  // under a sheet it has just opened (a Journal row, a Discover stop, a
  // Profile row behind the suggest form) — and that element is the opener.
  // Forgotten there, closing gave focus to <body>, or to the first journey
  // stop on the page instead of the one pressed.
  let pressed = { at: -1e9, on: null };
  document.addEventListener('pointerdown', (e) => { pressed = { at: e.timeStamp, on: e.target }; }, true);
  document.addEventListener('focusout', (e) => {
    if (e.relatedTarget || e.target !== lastInApp || document.getElementById('root')?.inert) return;
    const byPressElsewhere = e.timeStamp - pressed.at < 700 && pressed.on instanceof Node && !e.target.contains(pressed.on);
    if (byPressElsewhere) { lastInApp = null; lastMark = null; }
  }, true);
}
// A sheet with an address of its own (the suggest form) hands focus back
// to what opened it — the Profile row, the link in an empty search, the
// link on a place — or to that control's twin, where its part of the app
// was drawn again meanwhile. Closing it left focus on <body>.
export function useReturnFocus() {
  useEffect(() => {
    const active = document.activeElement;
    const opener = active && active !== document.body ? active : lastInApp;
    const mark = markOf(opener);
    return () => {
      const give = () => {
        const target = opener?.isConnected ? opener : findByMark(mark);
        const now = document.activeElement;
        // (…or on the sheet the opener is in: a place takes focus as a whole
        // when it is drawn again under the closing form.)
        if (target && (!now || now === document.body || (now !== target && now.contains(target)))) focusAfterOverlay(target);
      };
      give();
      setTimeout(give, 0);
    };
  }, []);
}
export function useInertRoot(open) {
  useEffect(() => {
    if (!open) return undefined;
    const root = document.getElementById('root');
    if (!root) return undefined;
    inertCount += 1;
    root.inert = true;
    return () => {
      inertCount -= 1;
      if (inertCount > 0) return;
      inertCount = 0;
      root.inert = false;
      const asked = wanted;
      wanted = null;
      // The opener itself, or its twin if the tab it was on has been
      // drawn again (above) — looked for once more a moment later, when
      // that tab is back on the page.
      const give = () => {
        const target = asked?.isConnected ? asked : lastInApp?.isConnected ? lastInApp : findByMark(lastMark);
        if (!target) return false;
        if (!document.activeElement || document.activeElement === document.body) target.focus?.({ preventScroll: true });
        return true;
      };
      if (!give()) setTimeout(give, 0);
    };
  }, [open]);
}
