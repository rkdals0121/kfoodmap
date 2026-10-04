// Text size, chosen in Profile and kept on this device only. Every size in
// the stylesheet is in pixels, so a reader who needs larger type had no way
// to get it short of zooming the whole page, map and all. The choice sets
// an attribute on <html>; index.css enlarges the reading surfaces (lists,
// place pages, panels) and leaves the map and the bars as they are.
export const TEXT_SIZE_KEY = 'kfm-text-size';
export const TEXT_SIZES = ['normal', 'large', 'larger'];

export function readTextSize() {
  try {
    const stored = localStorage.getItem(TEXT_SIZE_KEY);
    return TEXT_SIZES.includes(stored) ? stored : 'normal';
  } catch {
    return 'normal';
  }
}

export function applyTextSize(size, remember = false) {
  const value = TEXT_SIZES.includes(size) ? size : 'normal';
  if (value === 'normal') delete document.documentElement.dataset.text;
  else document.documentElement.dataset.text = value;
  if (!remember) return;
  try {
    if (value === 'normal') localStorage.removeItem(TEXT_SIZE_KEY);
    else localStorage.setItem(TEXT_SIZE_KEY, value);
  } catch { /* private mode: the choice lasts for this visit */ }
}
