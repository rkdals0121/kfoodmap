// The second tap of a double tap lands on whatever the first one brought up
// under the finger. Measured: on a card it fell on the place that had just
// opened — on "Call" (the dialler), on Save, on the week's hours; on the
// list's handle, on a card of the list that had risen; on an area in
// Discover, on the search box's clear button; on "Large", on the Language
// row that had moved down.
//
// So a press at the same spot within half a second of the last one counts
// only if it is on the same control (zoom twice, a chip on and off, "Next
// stop" again). On anything else it is dropped. A key press is aimed and is
// never dropped, nor is a click made by a script (both have `detail` 0).
// Imported in main.jsx before the app is drawn, so this listener runs
// before React's and before the map's.

// A pin or a cluster on the map is one control, whichever part of it is hit.
// (A press on a label is followed at once by a click on its box, made by the
// browser at the same spot: the two are one control.)
const control = (el) => {
  const on = el?.closest?.('button, a, summary, label, input, select, textarea, [role="button"], .leaflet-marker-icon') ?? el;
  return on?.tagName === 'LABEL' && on.control ? on.control : on;
};

let last = null;

if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    if (event.detail === 0) return;
    const on = control(event.target);
    const again = last
      && event.timeStamp - last.at < 500
      && Math.abs(event.clientX - last.x) < 30
      && Math.abs(event.clientY - last.y) < 30;
    if (again && on !== last.on) {
      // `last` stays: a third tap is measured against the first too.
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    last = { on, at: event.timeStamp, x: event.clientX, y: event.clientY };
  }, true);
}
