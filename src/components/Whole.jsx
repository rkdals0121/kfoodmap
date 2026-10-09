import React from 'react';

// A sentence with one part of it kept on one line: a date inside "Saved on
// …" is not left with its last letter on the next line ("2026年10月9" / "日" —
// a line may end between any two letters of Japanese or Chinese). By a
// span, not by joiner characters in the text: the words stay as they are
// for copying, for find-in-page and for a browser's page translator.
export function Whole({ text, part }) {
  const at = part ? String(text).indexOf(part) : -1;
  if (at < 0) return text;
  return <>{text.slice(0, at)}<span className="keep-together">{part}</span>{text.slice(at + part.length)}</>;
}
