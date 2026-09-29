import React from 'react';

// A Passport seal (dojang): the one Korean motif in the app, kept to the
// Journal (docs/UI-DIRECTION.md). Flat cinnabar ink, a double rule, the
// characters laid out as a seal is cut. Decorative: the place or badge name
// is always printed beside it as text.
export default function Seal({ chars, cols, earned = true, size = 'md' }) {
  return (
    <span
      className={`seal seal--${size}${earned ? '' : ' seal--locked'}`}
      style={{ '--seal-cols': cols, '--seal-n': chars.length }}
      aria-hidden="true"
    >
      {chars.map((c, i) => <span key={i}>{c}</span>)}
    </span>
  );
}
