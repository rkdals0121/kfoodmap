(() => {
  // Lines that end in the middle of something read as one piece: a clock
  // time and its AM/PM, a number and its unit, a price, a phone number,
  // "Line" and its number, "exit" and its number.
  const out = new Set();
  const R = document.createRange();
  const UNIT = /^(AM|PM|am|pm|min|mins|km|m|KRW|won|원|分|分钟|分鐘|menit|jam|時|时|시|분|人|名|階|층|F|%)\b/;
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const t = n.nodeValue;
    if (!t.trim() || t.length < 4) continue;
    const el = n.parentElement;
    if (!el || el.closest('script,style,svg,.leaflet-container,[inert],.visually-hidden,.skip-link,[hidden],.detail-topname')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    R.selectNodeContents(n);
    const rects = R.getClientRects();
    if (rects.length < 2) continue;
    // where each line of this text node ends
    let prevTop = null;
    for (let i = 0; i < t.length; i += 1) {
      R.setStart(n, i); R.setEnd(n, i + 1);
      const r = R.getClientRects()[0];
      if (!r || r.width === 0) continue;
      if (prevTop !== null && r.top > prevTop + 4) {
        const before = t.slice(0, i).trimEnd(), after = t.slice(i).trimStart();
        const b = before.slice(-14), a = after.slice(0, 14);
        let why = null;
        if (/\d$/.test(before) && UNIT.test(after)) why = 'number | unit';
        else if (/\d[-–]$/.test(before) && /^\d/.test(after) && /\d{2,4}[-–]\d{3,4}[-–]$/.test(before + '')) why = 'phone number';
        else if (/\d[:.]$/.test(before) && /^\d/.test(after)) why = 'clock time';
        else if (/(Line|line|exit|Exit|Jalur|pintu|出口|号线|號線|番出口)$/.test(before) && /^\d/.test(after)) why = 'word | its number';
        else if (/[₩$]$/.test(before) && /^\d/.test(after)) why = 'currency | amount';
        else if (/\d,$/.test(before) && /^\d{3}/.test(after)) why = 'inside a number';
        else if (/\($/.test(before) || /^[)）,.、。:：;!?]/.test(after)) why = 'at a bracket or mark';
        if (why) out.add(`BREAK ${why}: "${b}" / "${a}" in ${String(el.className || el.tagName).split(' ')[0]}`);
      }
      prevTop = r.top;
    }
  }
  return [...out].slice(0, 20);
})()
