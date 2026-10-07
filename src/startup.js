// What the welcome screen hands to the map it opens (src/Root.jsx shows
// the welcome screen on a first visit before the map's code and the places
// have arrived; App.jsx reads this once, as it starts).
export const startup = { welcomed: false, diet: [] };

// A first visit to the map itself: the welcome screen is shown at once.
// Not on a place or an area guide (the page asked for), nor with a list
// someone sent — App.jsx decides those, once it knows the places. The
// script in index.html works out the same answer earlier, to know which
// files to ask for; this is the rule both follow.
export function firstVisit() {
  if (typeof window === 'undefined') return false;
  if (typeof window.__kfmWelcome === 'boolean') return window.__kfmWelcome;
  let seen = false;
  try { seen = localStorage.getItem('kfm-prologue') === 'true'; } catch { /* storage blocked: not seen */ }
  return !seen && !/^\/(place|find)\//.test(window.location.pathname) && !/[?&]list=/.test(window.location.search);
}
