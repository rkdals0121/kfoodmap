(() => {
  const out = new Set();
  const R = document.createRange();
  for (const el of document.querySelectorAll('button, a, [role=button], summary, label, .chip, h1, h2, h3, li, p, dt, dd')) {
    if (el.closest('.leaflet-container,[inert],.visually-hidden,.skip-link,[hidden],.detail-topname')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.display === 'inline' || cs.display === 'contents') continue;
    const b = el.getBoundingClientRect();
    if (b.width < 4 || b.height < 4) continue;
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.nodeValue.trim() || n.parentElement.closest('.visually-hidden,svg')) continue;
      const pc = getComputedStyle(n.parentElement); if (pc.visibility === 'hidden' || pc.display === 'none') continue;
      R.selectNodeContents(n);
      let hit = false;
      for (const r of R.getClientRects()) {
        if (r.width < 1) continue;
        const over = Math.max(r.right - b.right, b.left - r.left);
        if (over > 2) {
          // inside something that scrolls sideways or clips on purpose
          let p = n.parentElement, ok = false;
          for (; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p); if (/auto|scroll/.test(o.overflowX) || (p !== el && /hidden|clip/.test(o.overflowX) && o.textOverflow === 'ellipsis')) { ok = true; break; } }
          if (!ok) { out.add('BTN-SPILL ' + Math.round(over) + ' ' + el.tagName + '.' + String(el.className || '').split(' ')[0] + ' "' + n.nodeValue.trim().slice(0, 20) + '"'); hit = true; }
          break;
        }
      }
      if (hit) break;
    }
  }
  return [...out].slice(0, 25);
})()
