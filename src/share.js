// Copying and sharing, the same way everywhere. Each screen had its own
// attempt and they failed differently: in an in-app browser (KakaoTalk,
// Instagram, LINE) the async clipboard is often refused, and a refused
// share was swallowed, so a tap did nothing at all.

/** Copy text. True when it is on the clipboard. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // No async clipboard here (an in-app browser, plain http): the old way.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

/**
 * Share with the phone's own sheet where there is one, otherwise copy.
 * 'shared' | 'copied' | 'dismissed' (the person closed the share sheet) |
 * 'failed' (nothing worked; the caller shows the text to copy by hand).
 */
export async function shareOrCopy({ title, text, url }) {
  const plain = [text, url].filter(Boolean).join('\n');
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, ...(text ? { text } : {}), ...(url ? { url } : {}) });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'dismissed';
      // Refused for another reason (some webviews): fall through and copy.
    }
  }
  return (await copyText(plain)) ? 'copied' : 'failed';
}
