// Following a food journey stop by stop. A journey is editorial curation
// (journeys.js) — this adds no fact about any place; it only says where in
// the journey an open place sits and what comes before and after it.
//
// Distances between stops are straight lines between the recorded
// coordinates, and are labelled as such: no routing call is made (HANDOFF
// §2.1), and a straight line across a river or a hill is not a walk.
import { haversineKm, coordsOf } from '../utils.js';

const km = (a, b) => {
  const p = coordsOf(a);
  const q = coordsOf(b);
  return haversineKm(p.lat, p.lng, q.lat, q.lng);
};

/** Straight-line km from each stop to the one before it (null for the first). */
export function legDistances(stops) {
  return stops.map((place, i) => (i === 0 ? null : km(stops[i - 1], place)));
}

/**
 * Where `index` sits in a journey.
 * `stops` are the journey's resolved places, in order. Returns null when the
 * index does not name a stop (a stale link, a journey that lost a stop).
 */
export function journeyNav(journey, stops, index) {
  if (!journey || !Array.isArray(stops) || !Number.isInteger(index)) return null;
  if (index < 0 || index >= stops.length) return null;
  const legs = legDistances(stops);
  return {
    id: journey.id,
    title: journey.title,
    index,
    total: stops.length,
    prev: index > 0 ? stops[index - 1] : null,
    next: index < stops.length - 1 ? stops[index + 1] : null,
    // From this stop on to the next one.
    nextKm: index < stops.length - 1 ? legs[index + 1] : null,
  };
}
