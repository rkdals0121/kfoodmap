(() => {
  const out = [];
  const text = document.body.innerText;
  const m = text.match(/.{0,25}(\bundefined\b|\bNaN\b|\[object |\{\{|\}\}|\bnull\b|detail\.[a-zA-Z]+|list\.[a-zA-Z]{4,}|hours\.[a-zA-Z]{4,}).{0,25}/g);
  if (m) out.push(...m.slice(0, 4).map(x => 'LEAK ' + x.replace(/\s+/g, ' ')));
  // a heading with nothing under it
  for (const h of document.querySelectorAll('.detail-sheet h3, .detail-sheet h4, .tab-panel h3')) {
    if (!h.offsetParent) continue;
    const sec = h.closest('section, .detail-section, .detail-body, details') ?? h.parentElement;
    const rest = (sec.innerText || '').replace(h.innerText, '').trim();
    if (rest.length < 2) out.push('EMPTY under "' + h.innerText.slice(0, 30) + '"');
  }
  // the same line twice in a row
  const lines = text.split('\n').map(s => s.trim()).filter(s => s.length > 12);
  for (let i = 1; i < lines.length; i += 1) if (lines[i] === lines[i - 1]) out.push('TWICE "' + lines[i].slice(0, 40) + '"');
  // punctuation doubled or a space before a mark
  const p = text.match(/.{0,18}(\.\.(?!\.)|,,| ,|\( | \)|·\s*·|：：|。。|、、|\s[.。](?:\s|$)).{0,12}/g);
  if (p) out.push(...p.slice(0, 3).map(x => 'PUNCT ' + x.replace(/\s+/g, ' ')));
  return out.slice(0, 12);
})()
