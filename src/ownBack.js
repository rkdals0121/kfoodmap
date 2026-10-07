// A step back in the history that the app takes itself — closing a place,
// a sheet or an overlay — as against the reader pressing Back. Both arrive
// as the same event. After the reader's Back the view that entry names is
// shown; after the app's own step the view on screen stays (chips changed
// while a place was open are not undone by closing it) and is written to
// the entry landed on (App.jsx).
let own = 0;
export function ownBack() {
  const mine = Date.now();
  own = mine;
  // The event follows within a moment, or not at all (nothing to go back to).
  setTimeout(() => { if (own === mine) own = 0; }, 1500);
}
// Asked once per event, by the first listener to hear it.
export function takeOwnBack() {
  const was = own !== 0;
  own = 0;
  return was;
}
