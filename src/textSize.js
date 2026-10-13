// Text size, chosen in Profile and kept on this device only. Every size in
// the stylesheet is in pixels, so a reader who needs larger type had no way
// to get it short of zooming the whole page, map and all. The choice sets
// an attribute on <html>; index.css enlarges the reading surfaces (lists,
// place pages, panels) and leaves the map and the bars as they are.
//
// Until a choice is made here, the device's own setting is followed: someone
// who has told their phone or browser to use larger type opened the app at
// the smallest size and had to find the setting in Profile to be able to
// read it. Nothing about that is stored — it is read again on every visit.
// (On Android the system's font size reaches the page only where the browser
// honours <meta name="text-scale"> in index.html — Chrome 150 on; elsewhere
// the setting in Profile is still the only way. Not tried on a real phone.)
export const TEXT_SIZE_KEY = 'kfm-text-size';
export const TEXT_SIZES = ['normal', 'large', 'larger'];

/** The size that goes with type `ratio` times the usual size. */
// (One step up on an iPhone is 19 px against 17: a little under 1.12.)
export const sizeForRatio = (ratio) => (ratio >= 1.3 ? 'larger' : ratio >= 1.1 ? 'large' : 'normal');

// How much larger than usual the device sets its text: the browser's default
// font size (16 px unless the reader changed it) and, on an iPhone or iPad,
// the system's Dynamic Type (17 px at its default).
export function deviceTextRatio() {
  try {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;left:-999px;top:0;font-size:medium';
    (document.body ?? document.documentElement).appendChild(probe);
    const medium = parseFloat(getComputedStyle(probe).fontSize) / 16;
    probe.style.font = '-apple-system-body';
    // Where the keyword is not understood the line above changes nothing, and
    // the size read is the browser's default again.
    const system = probe.style.font ? parseFloat(getComputedStyle(probe).fontSize) / 17 : 1;
    probe.remove();
    const ratio = Math.max(medium, system);
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  } catch {
    return 1;
  }
}

export function readTextSize() {
  try {
    const stored = localStorage.getItem(TEXT_SIZE_KEY);
    if (TEXT_SIZES.includes(stored)) return stored;
  } catch { /* storage blocked: the device's setting still counts */ }
  return typeof document === 'undefined' ? 'normal' : sizeForRatio(deviceTextRatio());
}

export function applyTextSize(size, remember = false) {
  const value = TEXT_SIZES.includes(size) ? size : 'normal';
  if (value === 'normal') delete document.documentElement.dataset.text;
  else document.documentElement.dataset.text = value;
  if (!remember) return;
  try {
    // "Normal" is kept too, once chosen: on a device set to large type it is a
    // choice against the device's setting, not the absence of one.
    localStorage.setItem(TEXT_SIZE_KEY, value);
  } catch { /* private mode: the choice lasts for this visit */ }
}
