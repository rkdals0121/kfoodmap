import { useEffect, useState } from 'react';

// "Add to Home Screen". A travel app is opened on the street, often with
// poor data: installed, it starts from the home screen and from its own
// cache. Offered once, quietly, in Profile — never as a banner over the map.
//
// Chrome and Edge (Android, desktop) fire `beforeinstallprompt`, which is
// kept here and replayed when the person asks. It can fire before React has
// rendered (the app waits for its language), so this module is imported for
// its side effect from main.jsx. Safari on iOS has no such event: there the
// only way is Share → Add to Home Screen, so the app says that instead.
let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

const standalone = () => typeof window !== 'undefined'
  && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);

// iPadOS reports itself as a Mac; a Mac has no touch points.
const isIos = () => typeof navigator !== 'undefined'
  && (/iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** 'installed' | 'prompt' (a button can install) | 'ios' (explain how) | 'none'. */
export function installState() {
  if (standalone()) return 'installed';
  if (deferred) return 'prompt';
  if (isIos()) return 'ios';
  return 'none';
}

export default function useInstall() {
  const [state, setState] = useState(installState);
  useEffect(() => {
    const update = () => setState(installState());
    listeners.add(update);
    update();
    return () => { listeners.delete(update); };
  }, []);
  const install = async () => {
    if (!deferred) return;
    const event = deferred;
    // A prompt can be shown once; whatever the answer, the event is spent.
    deferred = null;
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      // dismissed or unsupported: nothing to do
    }
    notify();
  };
  return { state, install };
}
