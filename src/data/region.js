// Which part of Korea a place is in, read from its street address, so the
// Journal can group a saved list that spans a trip ("Seoul", "Busan",
// "Jeju") — the neighbourhood label (zone) is too irregular for that.
//
// The province or metropolitan city is the last region word in an English
// address ("…, Gwangju-si, Gyeonggi-do" is Gyeonggi, not Gwangju), so the
// last match wins. North/South provinces are joined: a traveller plans by
// "Jeolla", not by the 1896 boundary. Not a trust claim — just grouping.
const REGIONS = [
  [/Seoul/g, 'Seoul'],
  [/Busan/g, 'Busan'],
  [/Incheon/g, 'Incheon'],
  [/Daegu/g, 'Daegu'],
  [/Daejeon/g, 'Daejeon'],
  [/Gwangju/g, 'Gwangju'],
  [/Ulsan/g, 'Ulsan'],
  [/Sejong/g, 'Sejong'],
  [/Gyeonggi/g, 'Gyeonggi'],
  [/Gangwon/g, 'Gangwon'],
  [/Chungcheong|Chungbuk|Chungnam/g, 'Chungcheong'],
  [/Jeolla|Jeonbuk|Jeonnam/g, 'Jeolla'],
  [/Gyeongsang|Gyeongbuk|Gyeongnam/g, 'Gyeongsang'],
  [/Jeju/g, 'Jeju'],
];

export function regionOf(place) {
  const address = place?.address?.value;
  if (typeof address !== 'string') return null;
  let best = null;
  let bestAt = -1;
  for (const [re, name] of REGIONS) {
    for (const m of address.matchAll(re)) {
      if (m.index > bestAt) { bestAt = m.index; best = name; }
    }
  }
  return best;
}

// Groups items (each with a .place) by region, biggest group first, keeping
// the given order inside a group. Places with no readable region go last.
export function groupByRegion(items) {
  const groups = new Map();
  for (const item of items) {
    const region = regionOf(item.place);
    if (!groups.has(region)) groups.set(region, []);
    groups.get(region).push(item);
  }
  return [...groups.entries()]
    .map(([region, list]) => ({ region, items: list }))
    .sort((a, b) => (a.region === null) - (b.region === null) || b.items.length - a.items.length);
}
