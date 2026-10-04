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
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
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
if (typeof document !== 'undefined') {
  document.addEventListener('focusin', (e) => {
    if (document.getElementById('root')?.contains(e.target)) lastInApp = e.target;
  }, true);
  // Focus that leaves for nowhere (a tap on plain content; Safari, where a
  // tapped button takes no focus) is not an opener to return to — the
  // search box focused a minute ago would otherwise be given focus, and
  // open the keyboard, when a confirmation closes.
  document.addEventListener('focusout', (e) => {
    if (!e.relatedTarget && e.target === lastInApp && !document.getElementById('root')?.inert) lastInApp = null;
  }, true);
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
      if ((!document.activeElement || document.activeElement === document.body) && lastInApp?.isConnected) {
        lastInApp.focus?.({ preventScroll: true });
      }
    };
  }, [open]);
}
