import React from 'react';
import { LeafIcon, CrescentIcon } from './Icons';
import { trustBadge } from '../data/verification';
import { CLAIM_CLASS } from './claim';

const ICON = { vegan: LeafIcon, halal: CrescentIcon };

// The claim mark (docs/UI-DIRECTION.md), one shape everywhere a dietary
// claim appears: a pill with the diet's icon, the claim, and how sure we
// are — fill and border style plus the word. Pass `fact` for a real record,
// or `level` + `tone` to draw an example (the prologue legend).
export default function ClaimChip({ kind, label, fact, level, tone }) {
  const badge = fact ? trustBadge(fact) : { label: level, tone };
  const Icon = ICON[kind];
  return (
    <span className={`claim claim-chip claim--${CLAIM_CLASS[badge.tone]}`}>
      {Icon && <Icon size={12} aria-hidden="true" />}
      {label ? <>{label}<span className="claim__level">{badge.label}</span></> : badge.label}
    </span>
  );
}
