// Other places close to an open one: the answer to "this one is shut — what
// else is here?". Straight-line distance between recorded coordinates, said
// to be one; no routing call (HANDOFF §2.1). Not a recommendation and not a
// ranking: nearest first, nothing else.
import { haversineKm, coordsOf } from '../utils.js';

export const NEARBY_MAX_KM = 0.8;
export const NEARBY_LIMIT = 3;

export function nearbyPlaces(place, all, { maxKm = NEARBY_MAX_KM, limit = NEARBY_LIMIT } = {}) {
  if (!place) return [];
  const here = coordsOf(place);
  return all
    .filter(r => r.id !== place.id)
    .map(r => {
      const c = coordsOf(r);
      return { place: r, km: haversineKm(here.lat, here.lng, c.lat, c.lng) };
    })
    .filter(x => x.km <= maxKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}
