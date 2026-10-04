import { useCallback, useEffect, useState } from 'react';

// The service worker (vite-plugin-pwa, registerType 'autoUpdate') installs a
// new version in the background and takes control of the open page — but the
// page keeps running the JavaScript it already loaded. Left alone, a returning
// visitor sees every deploy one visit late. Measured on 2026-09-28: a browser
// that had opened the site that morning ran a bundle three deploys old, with
// 18 pins, while the server was serving 73 — and only a second reload fixed it.
//
// When the new worker takes control, this decides what to do about it:
//   - the page had no controller before  → first install; nothing was stale.
//   - nobody has touched the page yet    → reload now; they lose nothing.
//   - they have (a report half-typed, a place open) → do not reload under
//     them; offer it instead. A reload that throws away someone's typing is a
//     worse bug than one visit of stale data.
export function onControllerChange({ hadController, interacted }) {
  if (!hadController) return 'ignore';
  return interacted ? 'offer' : 'reload';
}

export default function useAppUpdate() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
    if (!sw) return undefined;

    const hadController = Boolean(sw.controller);
    let interacted = false;
    let handled = false;
    const markInteracted = () => { interacted = true; };

    const onChange = () => {
      // controllerchange can fire more than once in a session; act once.
      if (handled) return;
      handled = true;
      const action = onControllerChange({ hadController, interacted });
      if (action === 'reload') window.location.reload();
      else if (action === 'offer') setUpdateReady(true);
    };

    window.addEventListener('pointerdown', markInteracted, { capture: true });
    window.addEventListener('touchstart', markInteracted, { capture: true, passive: true });
    window.addEventListener('keydown', markInteracted, { capture: true });
    sw.addEventListener('controllerchange', onChange);
    return () => {
      window.removeEventListener('pointerdown', markInteracted, { capture: true });
      window.removeEventListener('touchstart', markInteracted, { capture: true });
      window.removeEventListener('keydown', markInteracted, { capture: true });
      sw.removeEventListener('controllerchange', onChange);
    };
  }, []);

  const reload = useCallback(() => window.location.reload(), []);
  return { updateReady, reload };
}
