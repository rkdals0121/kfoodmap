import React from 'react';

// Wraps each run of Hangul in <span lang="ko">, so a screen reader reads
// "한돈 제육 정식" with a Korean voice inside an English sentence (WCAG
// 3.1.2). Runs may contain spaces between Hangul words.
const HANGUL_RUN = /([가-힣]+(?:\s+[가-힣]+)*)/;

export default function KoText({ children }) {
  const text = String(children ?? '');
  if (!/[가-힣]/.test(text)) return text;
  return text.split(HANGUL_RUN).map((part, i) => (
    i % 2 === 1 ? <span key={i} lang="ko">{part}</span> : part
  ));
}
