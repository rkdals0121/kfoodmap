// askConfirm(message, { confirmLabel }) → Promise<boolean>. The question is
// shown by the app (components/ConfirmHost.jsx), which registers itself
// here; before it has, or outside a browser tree, the browser's own
// confirm answers.
let host = null;

export function registerConfirmHost(fn) {
  host = fn;
  return () => { if (host === fn) host = null; };
}

export function askConfirm(message, options = {}) {
  if (!host) return Promise.resolve(typeof window !== 'undefined' && window.confirm(message));
  return host(message, options);
}
