// Mechanical review of drafted restaurant entries before they reach
// src/data/restaurants.js.
//
//   node scripts/review-drafts.mjs <draft.json> [<draft.json> ...]
//
// Every check here is a failure a human reviewer caught by hand in the
// 2026-09-28 expansion rounds, turned into something a machine catches
// first. It does not replace review: it decides what a human must look at.
// PASS means "nothing mechanical found", not "verified".
//
// What it cannot catch, and a person must: a claim that changes meaning
// between sources ("Michelin-starred" where every source says "listed"); a
// conflict recorded only in the research notes rather than the entry (three
// addresses for one restaurant); evidence that is current in form but old in
// substance (a 2015 halal claim). Read the notes for every FLAG and LOOK.
//
// Exit code is 1 if any draft is FLAGGED, so a batch cannot be merged by a
// script that did not read this output.

import fs from 'node:fs';
import { restaurants } from '../src/data/restaurants.js';
import { SOURCE, METHOD, CONFIDENCE, HALAL, isKnown, validateDietary } from '../src/data/verification.js';

const hangul = s => (String(s ?? '').match(/[가-힣]+/g) ?? []).join('');
const normAddress = s => String(s ?? '')
  .toLowerCase()
  .replace(/\(.*?\)/g, '')
  .replace(/\b\d+f(-\d+f)?\b|\bb\d+\b|\d+층/g, '')   // a floor is not a different place
  .replace(/[\s,.-]/g, '');

const SOURCES = new Set(Object.values(SOURCE));
const METHODS = new Set(Object.values(METHOD));

// Evidence nobody can reopen. Every one of these reached a draft in round 1 or 2.
const UNTRACEABLE = /research aggregation|aggregat(ion|or)s?|websearch|search (result )?summar|blog coverage|several (sites|blogs|sources) (say|describe|report)/i;
// Copy that reaches travellers must not sell, and must not narrate our process.
const PROMOTIONAL = /\b(popular|beloved|loved by|much-loved|long-standing following|famous|renowned|must-visit|best in|hidden gem|followers?|a following of|following of)\b/i;
const PROCESS_TALK = /\b(recorded as|we (did|chose|treated|recorded)|was not treated as|this entry (does not|claims)|rather than guess(ed)?|left (it )?off the map|per the (brief|rule))\b/i;
// A superlative is fine only when a named source is credited for it in the same sentence.
// "only" on its own is usually a plain fact ("only a lunch and a dinner
// course"); "the only" is the claim worth checking.
const SUPERLATIVE = /\b(first|the only|oldest|largest|biggest)\b/i;
const ATTRIBUTION = /\b(called|calls|describes|described|says|said|told|tells|reports|reported|claims|claimed|notes|noted|states|stated|lists|listed|names|according to|billed|bills)\b/i;
const URL_RE = /https?:\/\/|\b[\w-]+\.(com|net|kr|org|ee|co)\b/i;

function review(paths) {
  const existing = restaurants.map(r => ({
    id: r.id,
    han: hangul(r.name),
    addr: normAddress(r.address?.value),
    lat: r.coordinates?.value?.lat,
    lng: r.coordinates?.value?.lng,
  }));
  const model = Object.keys(restaurants.find(r => r.id === 'cosmos-shop') ?? restaurants[0]);
  const REQUIRED = model.filter(k => !['phone', 'officialUrl', 'instagram', 'imageLeads', 'lifecycle', 'transit'].includes(k));

  const seenInBatch = [];
  let flagged = 0;
  let total = 0;

  for (const path of paths) {
    let drafts;
    try {
      drafts = JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (e) {
      console.log(`\n${path}: UNREADABLE — ${e.message}`);
      flagged += 1;
      continue;
    }
    console.log(`\n=== ${path} (${drafts.length})`);

    for (const r of drafts) {
      total += 1;
      const issues = [];
      // Two severities. An error must be fixed or the draft dropped. A warning
      // is something a person should look at, which may well be fine: a
      // second branch shares its Korean name with the first, a directory
      // claim has no URL recorded. Only errors flag a draft.
      const warn = msg => issues.push(`WARN ${msg}`);
      const han = hangul(r.name);
      const addr = normAddress(r.address?.value);

      // Shape
      for (const k of REQUIRED) if (!(k in r)) issues.push(`missing field "${k}"`);
      if (!r.dietary?.vegan || !r.dietary?.halal) issues.push('dietary.vegan / dietary.halal missing');

      // Duplicates — against the dataset and against the rest of this batch.
      // Korean name catches the round-2 near-miss (일용할양식 under a new romanisation).
      for (const e of [...existing, ...seenInBatch]) {
        if (e.id === r.id) issues.push(`id already used by ${e.from ?? 'dataset'}`);
        if (han && e.han && han.length >= 2 && (han === e.han || han.includes(e.han) || e.han.includes(han))) {
          // A shared name alone may be a sister branch; a shared address or
          // coordinates as well is the same restaurant, and is an error below.
          warn(`same Korean name as ${e.id}${e.from ? ` (${e.from})` : ''} — a branch, or the same place?`);
        }
        if (addr && e.addr && addr === e.addr) issues.push(`same address as ${e.id}${e.from ? ` (${e.from})` : ''}`);
        if (e.lat && r.coordinates?.value && Math.abs(e.lat - r.coordinates.value.lat) < 0.00005
          && Math.abs(e.lng - r.coordinates.value.lng) < 0.00005) {
          issues.push(`same coordinates as ${e.id}`);
        }
      }

      // Canonical provenance values — a near-miss ships a line with no label.
      const walk = (o, p) => {
        if (!o || typeof o !== 'object') return;
        for (const [k, v] of Object.entries(o)) {
          if (k === 'source' && v && !SOURCES.has(v)) issues.push(`non-canonical source at ${p}: "${v}"`);
          if (k === 'method' && v && !METHODS.has(v)) issues.push(`non-canonical method at ${p}: "${v}"`);
          if (typeof v === 'object') walk(v, `${p}.${k}`);
        }
      };
      walk(r, r.id);

      // Naver was unreachable for the whole session. A draft claiming the two
      // maps agree is claiming a check nobody could have run.
      const cm = r.coordinates?.method;
      if (cm === METHOD.MAP_CROSSCHECK || cm === 'Naver Place and Kakao Map agree') {
        issues.push('coordinates claim a Naver cross-check, but Naver was unreachable');
      }

      // Location sanity: Korea's bounding box.
      const c = r.coordinates?.value;
      if (c && (c.lat < 33 || c.lat > 38.7 || c.lng < 124.5 || c.lng > 131)) issues.push(`coordinates outside Korea (${c.lat}, ${c.lng})`);

      // The fact() invariant, and CONFIRMED's audit trail.
      for (const [name, f] of Object.entries({
        coordinates: r.coordinates, address: r.address, hours: r.hours, menus: r.menus,
        'dietary.vegan': r.dietary?.vegan, 'dietary.halal': r.dietary?.halal,
      })) {
        if (!f) continue;
        if (f.confidence === CONFIDENCE.UNKNOWN && f.value !== null) issues.push(`${name} is unknown but holds a value`);
        if (f.value === null && f.confidence !== CONFIDENCE.UNKNOWN) issues.push(`${name} has no value but claims ${f.confidence}`);
        if (isKnown(f) && !f.source) issues.push(`${name} is known with no source`);
        if (f.confidence === CONFIDENCE.CONFIRMED && (!f.lastCheckedAt || !f.method || !f.evidence)) {
          issues.push(`${name} is confirmed without lastCheckedAt/method/evidence`);
        }
        if (UNTRACEABLE.test(f.evidence ?? '')) {
          // Decisive for a dietary level; worth a look anywhere else.
          if (name.startsWith('dietary')) issues.push(`${name} evidence cites an untraceable source`);
          else warn(`${name} evidence mentions an untraceable source`);
        }
      }

      // Dietary facts must be reopenable.
      for (const k of ['vegan', 'halal']) {
        const f = r.dietary?.[k];
        if (f && isKnown(f) && !f.url && !URL_RE.test(f.evidence ?? '')) warn(`${k} is ${f.value}/${f.confidence} with no URL recorded — can someone reopen it?`);
      }

      // Halal specifics.
      const h = r.dietary?.halal;
      if (h?.value === HALAL.CERTIFIED) issues.push('halal CERTIFIED — needs a human to see the certificate reference');
      // A claim is the word used affirmatively — not "no certificate sighted".
      const claimsCertified = /\bcertified\b/i.test(h?.evidence ?? '')
        && !/\b(not|never|neither|nor|no|rather than|instead of|short of)\b[^.]{0,30}\bcertified\b/i.test(h?.evidence ?? '');
      if (h && isKnown(h) && claimsCertified && !r.dietary.halalCertClaim && h.value !== HALAL.CERTIFIED) {
        issues.push('halal evidence mentions certification but no halalCertClaim is recorded');
      }
      if (h && isKnown(h) && /\b(one|a single|at least one)\b[^.]*\b(item|dish|menu)\b/i.test(h.evidence ?? '')
        && !/\b(not|rather than)\s+(just\s+)?(one|a single)\b/i.test(h.evidence ?? '')) {
        issues.push('halal rests on individual items — friendly means the whole restaurant');
      }
      // Round 3: a Korean restaurant marked halal-friendly on "no pork, no
      // alcohol". Pork-free is its own level and says nothing about slaughter
      // or cross-contamination; it does not appear under the Halal filter.
      // Only the quoted source text counts: evidence strings mix the source's
      // words with the researcher's commentary, and "held at FRIENDLY, not
      // CERTIFIED" says halal without any source having said it.
      if (h && (h.value === HALAL.FRIENDLY || h.value === HALAL.CERTIFIED)) {
        // Each quote style is read on its own, so a double-quoted passage that
        // itself contains 'single-quoted' names is still read whole.
        const ev = String(h.evidence ?? '');
        const quotes = [/"([^"]{4,})"/g, /“([^”]{4,})”/g, /(?<![A-Za-z])'((?:[^']|'(?=[A-Za-z])){4,}?)'(?![A-Za-z])/g, /‘([^’]{4,})’/g]
          .flatMap(re => [...ev.matchAll(re)].map(m => m[1]));
        const HALAL_WORDS = /halal|할랄|muslim|무슬림|islamic|이슬람|zabiha|dhabiha/i;
        if (quotes.length === 0) warn('halal evidence quotes no source text — what did the source actually say?');
        else if (!quotes.some(q => HALAL_WORDS.test(q))) {
          issues.push(`halal ${h.value} but no quoted source says halal — if it only says no pork, the level is porkFree`);
        }
      }
      // Round 3: "모든 메뉴는 채식" taken as fully vegan. 채식 is vegetarian —
      // eggs and dairy are often in — and a vegan level must rest on a source
      // that says vegan or plant-based.
      const v = r.dietary?.vegan;
      if (v && v.value === 'full') {
        const ev = String(v.evidence ?? '');
        const vq = [/"([^"]{4,})"/g, /“([^”]{4,})”/g, /(?<![A-Za-z])'((?:[^']|'(?=[A-Za-z])){4,}?)'(?![A-Za-z])/g, /‘([^’]{4,})’/g]
          .flatMap(re => [...ev.matchAll(re)].map(m => m[1]));
        const saysVegan = vq.some(q => /비건|vegan|식물성|plant-based|plant based|동물성/i.test(q));
        const saysVegetarian = vq.some(q => /채식|vegetarian/i.test(q));
        if (vq.length && saysVegetarian && !saysVegan) {
          issues.push('vegan full but the quoted source says 채식/vegetarian, not vegan — eggs and dairy may be in');
        }
      }
      for (const p of validateDietary(r)) issues.push(`validateDietary: ${p}`);

      // Copy shown to travellers.
      for (const [label, text] of [['vibe', r.vibe], ['story', r.story]]) {
        const t = String(text ?? '');
        if (!t.trim()) issues.push(`${label} is empty — the detail page renders it unconditionally`);
        if (UNTRACEABLE.test(t)) issues.push(`${label} cites an untraceable source`);
        if (PROMOTIONAL.test(t)) issues.push(`${label} promotional: "${t.match(PROMOTIONAL)[0]}"`);
        if (PROCESS_TALK.test(t)) issues.push(`${label} narrates our process: "${t.match(PROCESS_TALK)[0]}"`);
        for (const sentence of t.split(/(?<=[.!?])\s+/)) {
          // "first floor" is a location, not a superlative.
          const bare = sentence.replace(/\w+-only\b|\bby reservation only\b/gi, '').replace(/\bfirst (floor|basement|level)\b|\bon the first\b|\b1st\b/gi, '');
          if (SUPERLATIVE.test(bare) && !ATTRIBUTION.test(bare)) {
            issues.push(`${label} unattributed superlative: "${sentence.slice(0, 90)}"`);
          }
        }
      }
      if (r.menus && r.menus.confidence === CONFIDENCE.UNKNOWN && /\bserves?\b[^.]*,/i.test(r.story ?? '')) {
        warn('story lists dishes while menus is unknown — check each is sourced');
      }

      // check-data rejects any other shape after the entry is appended; catch
      // it here, before (batch 6 shipped two plain strings).
      const hv = r.hours?.value;
      if (hv != null && (typeof hv !== 'object' || !hv.raw || (hv.weekly && typeof hv.weekly !== 'object'))) {
        issues.push('hours.value must be { raw, weekly } (see an existing entry), not a plain string');
      }

      const errors = issues.filter(i => !i.startsWith('WARN'));
      if (errors.length) flagged += 1;
      console.log(`${errors.length ? 'FLAG' : issues.length ? 'LOOK' : 'PASS'}  ${r.id}  ${han}  vegan=${r.dietary?.vegan?.value ?? '-'}/${r.dietary?.vegan?.confidence ?? '-'}  halal=${h?.value ?? '-'}/${h?.confidence ?? '-'}`);
      for (const i of issues) console.log(`        - ${i}`);

      seenInBatch.push({ id: r.id, han, addr, lat: c?.lat, lng: c?.lng, from: path.split(/[\\/]/).pop() });
    }
  }

  console.log(`\n${total} draft(s): ${flagged} FLAG (must fix or drop), ${total - flagged} PASS or LOOK (LOOK = warnings for a person to read).`);
  process.exitCode = flagged ? 1 : 0;
}

// Dispatched last: the helpers above are `const`, so calling review() before
// them would hit the temporal dead zone.
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/review-drafts.mjs <draft.json> [...]');
  process.exitCode = 2;
} else {
  review(files);
}
