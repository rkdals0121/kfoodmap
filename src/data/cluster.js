// Groups map pins that would sit on top of each other on screen.
//
// Measured 2026-09-28 on a 375x812 phone at the default zoom: 30 of 38
// visible pins were covered by another pin, so most places could not be
// tapped on their own (HANDOFF §7 #37). A pin is 34 px wide; two pins whose
// anchors are closer than that overlap.
//
// Works in screen pixels at the current zoom, so the caller projects
// lat/lng first (map.project). Greedy and deterministic: points are taken in
// the order given, each unclaimed point seeds a group and claims every
// unclaimed point within `radius` of it. The same input always gives the
// same groups, so pins do not reshuffle between renders at the same zoom.
export const CLUSTER_RADIUS_PX = 40;

export function clusterPoints(points, radius = CLUSTER_RADIUS_PX) {
  const r2 = radius * radius;
  const claimed = new Array(points.length).fill(false);
  const groups = [];
  for (let i = 0; i < points.length; i++) {
    if (claimed[i]) continue;
    claimed[i] = true;
    const seed = points[i];
    const members = [seed];
    for (let j = i + 1; j < points.length; j++) {
      if (claimed[j]) continue;
      const dx = points[j].x - seed.x;
      const dy = points[j].y - seed.y;
      if (dx * dx + dy * dy <= r2) {
        claimed[j] = true;
        members.push(points[j]);
      }
    }
    groups.push(members);
  }
  return groups;
}

// A group whose members all sit within a few metres of each other will never
// come apart by zooming (several restaurants share 192 Itaewon-ro). For
// those, tapping the group should list the places instead of zooming.
const SAME_SPOT_DEG = 0.0002; // ~20 m

export function isSameSpot(latlngs) {
  if (latlngs.length < 2) return true;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const { lat, lng } of latlngs) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return maxLat - minLat <= SAME_SPOT_DEG && maxLng - minLng <= SAME_SPOT_DEG;
}
