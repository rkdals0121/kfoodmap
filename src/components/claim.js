// The claim mark (docs/UI-DIRECTION.md): how sure we are about a dietary
// claim, carried by the chip's fill and border style plus a word — never by
// colour alone. Maps trustBadge()'s tone to the CSS modifier.
export const CLAIM_CLASS = { strong: 'confirmed', medium: 'reported', weak: 'reading', none: 'unknown' };
