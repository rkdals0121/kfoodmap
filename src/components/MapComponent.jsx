import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, AttributionControl, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';
import { MAP_CENTER, coordsOf } from '../utils';
import { clusterPoints, isSameSpot, CLUSTER_RADIUS_PX, DOT_CLUSTER_RADIUS_PX } from '../data/cluster';
import { dietaryBadges, trustBadge } from '../data/verification';
import { pinKind } from '../data/pin-kind';
import { matchesArea } from '../filters';
import { isCoarse } from '../data/locate';

// The middle of the part of the map a person can see. On a phone the list
// sheet covers the lower half, so the map's own centre sits under the sheet.
// How much of the map's left a docked place lies over (three columns, from
// 1200 px: the place sits beside the list, on the map).
function dockCover(map) {
  const panel = document.querySelector('.detail-sheet--docked')?.getBoundingClientRect();
  if (!panel) return 0;
  const box = map.getContainer().getBoundingClientRect();
  return panel.right > box.left && panel.left < box.right ? Math.max(0, Math.min(panel.right - box.left, box.width - 240)) : 0;
}

// The middle of the part of the map that can be seen: above the sheet on a
// phone, and to the right of a docked place. Without the second, opening a
// place at 1280 px moved its pin clear of the panel and the list was then
// sorted from a point 200 px to the pin's left — seven kilometres away at
// the opening zoom, another part of the city, the open place not in it.
function visibleCenter(map) {
  const size = map.getSize();
  const cover = dockCover(map);
  return map.containerPointToLatLng([cover + (size.x - cover) / 2, (size.y - sheetOverlap(map)) / 2]);
}

// Reports the visible centre upward after each pan/zoom so the list can
// re-sort by distance from what is on screen, not from a point hidden
// under the sheet.
// For a screen reader the map is one named region. Its hundreds of markers
// are left out of what is read: every one of them is a card in the list,
// with its claims, and swiping through 319 pins came before the search box.
function MapA11y() {
  const map = useMap();
  const { t } = useTranslation();
  const label = t('map.region');
  useEffect(() => {
    const el = map.getContainer();
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', label);
    for (const name of ['markerPane', 'tilePane', 'shadowPane']) map.getPane(name)?.setAttribute('aria-hidden', 'true');
  }, [map, label]);
  return null;
}

function CenterReporter({ onCenterChange, sheetState, userLocation }) {
  const map = useMap();
  // A docked place opening or closing also moves the middle of what shows
  // (visibleCenter) without moving the map. That is not reported: the list
  // would reshuffle as the place closed, and the card to go back to — the
  // place just read — could be sorted off its first page.
  const lastSheet = useRef(sheetState);
  const beforeFull = useRef(sheetState);
  // The sheet changing height moves the middle of what can be seen without
  // moving the map: say so once it has settled, or "nearest" is measured
  // from a point now under the sheet.
  const firstSheet = useRef(true);
  useEffect(() => {
    // On arrival too: the first sort was from the map's own middle, part
    // of it under the sheet, and the first fold of the sheet reshuffled it.
    const first = firstSheet.current;
    firstSheet.current = false;
    const from = lastSheet.current;
    lastSheet.current = sheetState;
    // Not into the full sheet: it opens while the list is being scrolled,
    // and re-sorting then moved the cards under the finger. Nor out of it
    // back to where it was. Out of it to the other height is a real change.
    if (sheetState === 2) { if (from !== 2) beforeFull.current = from; return undefined; }
    if (!first && from === 2 && beforeFull.current === sheetState) return undefined;
    const id = setTimeout(() => {
      const c = visibleCenter(map);
      // Standing on "my location": folding the sheet must not turn "nearest
      // to you" into "nearest to a point 400 m up the road".
      if (userLocation && map.distance(c, [userLocation.lat, userLocation.lng]) < 1000) return;
      onCenterChange([c.lat, c.lng]);
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetState]);
  useMapEvents({
    moveend: (e) => {
      const c = visibleCenter(e.target);
      onCenterChange([c.lat, c.lng]);
    },
  });
  return null;
}

// Opening on a phone, the start point (central Seoul) was the map's own
// centre — just under the sheet's top edge — so the strip above it showed
// the empty mountains north of the city (2026-09-30). Shift the first view
// so the start point sits in the middle of the visible strip.
function StartInView() {
  const map = useMap();
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const overlap = sheetOverlap(map);
      if (overlap > 0) map.panBy([0, overlap / 2], { animate: false });
    });
    return () => cancelAnimationFrame(id);
  }, [map]);
  return null;
}

// The map-region's own size changes at each responsive breakpoint (46vh
// stacked on mobile vs. full-height split column on tablet/desktop).
// Leaflet doesn't know its container resized unless told, so it would
// otherwise render stale/cropped tiles right after a breakpoint change.
function ResizeSync() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

// What a pin says about the place, by shape rather than colour: a leaf for
// vegan (full or options), a crescent for halal (certified or friendly),
// both side by side, or the plain dot. Pork-free is not halal, so it never
// gets the crescent. Same icons as the detail page's dietary facts.
const LEAF = 'M20 4c0 8.5-5.5 15-15 15C5 10.5 11.5 4 20 4Z M5 19c3.5-5.5 7.5-9.5 11-12';
const CRESCENT = 'M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 1 0 10.5 10.5Z';
const glyph = (d, x, y, scale, colour) =>
  `<path d="${d}" transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${colour}" stroke-width="${2.4 / scale * 0.5}" stroke-linecap="round" stroke-linejoin="round"/>`;
const pinGlyph = (kind, colour) => {
  if (kind === 'vegan') return glyph(LEAF, 10.4, 9.2, 0.55, colour);
  if (kind === 'halal') return glyph(CRESCENT, 10.4, 9.2, 0.55, colour);
  if (kind === 'both') return glyph(LEAF, 6.2, 11.2, 0.4, colour) + glyph(CRESCENT, 17, 11.2, 0.4, colour);
  return `<circle cx="17" cy="15.8" r="5" fill="${colour}"/>`;
};

// Teardrop pin: white body with green outline, solid green when selected
const makePinIcon = (kind, selected) => L.divIcon({
  className: `k-pin k-pin--${kind}${selected ? ' k-pin--active' : ''}`,
  html: `<svg width="${selected ? 38 : 28}" height="${selected ? 49 : 36}" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 42.5C17 42.5 31.5 26.4 31.5 15.6C31.5 7.6 25 1.5 17 1.5C9 1.5 2.5 7.6 2.5 15.6C2.5 26.4 17 42.5 17 42.5Z"
      fill="${selected ? '#0E9F6E' : '#FFFFFF'}" stroke="${selected ? '#087F5B' : '#0E9F6E'}" stroke-width="2.5"/>
    ${pinGlyph(kind, selected ? '#FFFFFF' : '#087F5B')}
  </svg>`,
  // The open place's pin is a size up: at a city view it sits among dots
  // and count circles, and has to be the one thing the eye finds.
  iconSize: selected ? [38, 49] : [28, 36],
  iconAnchor: selected ? [19, 48] : [14, 35],
});

// Zoomed out, a single place is a small dot rather than a pin: at city
// scale a field of tall pins reads as clutter (2026-09-30), and what the
// overview has to say is where the food is, not what each place serves.
// Full pins, with their leaf / crescent, from DOT_BELOW_ZOOM up. The dot
// keeps a 32 px tap area around its 12 px mark (dots are
// grouped 40 px apart, so tap areas never overlap).
const DOT_BELOW_ZOOM = 14;
const makeDotIcon = (kind) => L.divIcon({
  className: `k-dot k-dot--${kind}`,
  html: '<span aria-hidden="true"></span>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});
const DOTS = new Map();
const dotIcon = (r) => {
  const kind = pinKind(r);
  if (!DOTS.has(kind)) DOTS.set(kind, makeDotIcon(kind));
  return DOTS.get(kind);
};

// A saved place: a round badge with a heart, at every zoom and never folded
// into a count, so a trip's shortlist can be read off the map without
// turning a filter on. The heart is the same glyph as the Save button.
// Two saved places in one building would draw one heart on top of the
// other, and only one could be tapped: each further heart at the same spot
// is shifted sideways (`shift`), the first stays on its point.
const SAVED_ICONS = new Map();
const savedIcon = (shift = 0) => {
  if (!SAVED_ICONS.has(shift)) {
    SAVED_ICONS.set(shift, L.divIcon({
      className: 'k-saved',
      html: '<span aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></span>',
      iconSize: [32, 32],
      iconAnchor: [16 - shift * 28, 16],
    }));
  }
  return SAVED_ICONS.get(shift);
};
const HEART_OVERLAP_PX = 24;

// A journey's stop: its number in the route, so the order can be read off
// the map. Like a saved place it is never folded into a count.
const STOPS = new Map();
const stopIcon = (n, active = false) => {
  const key = active ? `${n}*` : n;
  if (!STOPS.has(key)) {
    STOPS.set(key, L.divIcon({
      className: `k-stop${active ? ' k-stop--active' : ''}`,
      html: `<span aria-hidden="true">${n}</span>`,
      iconSize: active ? [40, 40] : [32, 32],
      iconAnchor: active ? [20, 20] : [16, 16],
    }));
  }
  return STOPS.get(key);
};

// Built once. react-leaflet calls setIcon whenever the icon prop is a new
// object, and the map re-renders on every pan (the list's sort centre lives
// in App state), so a fresh divIcon per render meant redrawing every pin in
// the country after each drag.
const PINS = new Map();
const pinIcon = (r, selected) => {
  const key = `${pinKind(r)}:${selected}`;
  if (!PINS.has(key)) PINS.set(key, makePinIcon(pinKind(r), selected));
  return PINS.get(key);
};
// A pin's accessible name carries what it says and how sure we are:
// "EID · Halal-friendly, reported". The strength stays off the drawn pin,
// which is too small to show it honestly.
const pinLabel = (r) => [
  r.name,
  ...dietaryBadges(r).map(b => `${b.label}, ${trustBadge(b.fact).label.toLowerCase()}`),
].join(' · ');

// Count badge for pins that would overlap at this zoom (see data/cluster.js).
const clusterIcons = new Map();
const clusterIcon = (count) => {
  if (!clusterIcons.has(count)) {
    // Sized by how many places it holds, so the map reads at a glance
    // where the food is, without every group shouting the same. A handful
    // is barely bigger than a dot, so the big groups carry the picture.
    const size = count < 5 ? 22 : count < 10 ? 26 : count < 50 ? 34 : 42;
    clusterIcons.set(count, L.divIcon({
      className: `k-cluster${count < 5 ? ' k-cluster--few' : ''}`,
      html: `<span aria-hidden="true" style="width:${size}px;height:${size}px">${count}</span>`,
      // At least the 32 px tap area a dot has, whatever the drawn size.
      iconSize: [Math.max(size, 32), Math.max(size, 32)],
      iconAnchor: [Math.max(size, 32) / 2, Math.max(size, 32) / 2],
    }));
  }
  return clusterIcons.get(count);
};

// On a phone the list sheet slides up over the lower part of the map, which
// stays full height underneath it. Zooming to a group has to fit the places
// into the part still showing, or half of them land under the sheet.
function sheetOverlap(map) {
  // (A place half open over the list is what covers the map then.)
  const sheet = document.querySelector('.detail-sheet--peek') ?? document.querySelector('.sidebar-region');
  if (!sheet) return 0;
  const m = map.getContainer().getBoundingClientRect();
  const s = sheet.getBoundingClientRect();
  const spansMap = s.left <= m.left + 1 && s.right >= m.right - 1;
  if (!spansMap || s.top >= m.bottom) return 0;
  // Leave at least a strip to fit into, even with the sheet pulled up high.
  return Math.max(0, Math.min(m.bottom - Math.max(s.top, m.top), m.height - 240));
}

// flyToBounds with padding larger than the map itself (a zero-size map in a
// hidden or collapsing container, or a sheet covering most of it) computes a
// NaN zoom and throws — and an uncaught throw in an effect blanked the whole
// app. Only fly when there is room; never let a map move take the app down.
// Asked each time: the setting can change while the app stays open.
const reduceMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

// Zoomed all the way out the map was the whole world, grey above the list,
// with every place under one dot beneath it and no way back but pinching.
// Korea with room around it (the list covers half the screen, so the
// south needs slack for Jeju to sit above it).
// Wide to the south: at the lowest zoom the screen is a dozen degrees
// tall, and with tighter bounds Korea sat fixed behind the list, unable to
// be dragged up into view.
const KOREA_AND_AROUND = [[10, 104], [52, 150]];

function safeFlyToBounds(map, latlngs, padTL, padBR, options) {
  const size = map.getSize();
  if (size.x - padTL[0] - padBR[0] < 40 || size.y - padTL[1] - padBR[1] < 40) return;
  try {
    // Asked for less motion: the map is set there, not flown there (the
    // CSS rule for it does not reach Leaflet's own animation).
    if (reduceMotion()) map.fitBounds(L.latLngBounds(latlngs), { paddingTopLeft: padTL, paddingBottomRight: padBR, maxZoom: options?.maxZoom, animate: false });
    else map.flyToBounds(L.latLngBounds(latlngs), { paddingTopLeft: padTL, paddingBottomRight: padBR, ...options });
  } catch {
    // leave the map where it is
  }
}

// When a search or filter leaves nothing on screen — someone types "Busan"
// while the map shows Seoul — move the map to what was found. Only then: if
// any result is already visible, the map stays where the person put it.
// When the search names an area, the places in that area are the ones to
// show: "Busan" also finds Seoul's "Busan Jib", which used to keep the map
// on Seoul because one result was already in view.
function FollowResults({ restaurants: all, searchQuery, fitAll = false, placeOpen = false }) {
  const map = useMap();
  const inArea = all.filter(r => matchesArea(r, searchQuery));
  const restaurants = inArea.length > 0 ? inArea : all;
  const key = restaurants.map(r => r.id).join(',');
  const first = useRef(true);
  // '' so that a search the app opens with counts as a search just made.
  const framedFor = useRef('');
  // The framing put off while the app opened on a place (below), and the
  // closing of that place, which calls for it.
  const owed = useRef(false);
  const [closed, setClosed] = useState(0);
  useEffect(() => {
    if (!placeOpen && owed.current) { owed.current = false; setClosed(n => n + 1); }
  }, [placeOpen]);
  useEffect(() => {
    // The first run is the app opening, where the map keeps its start
    // view — unless it opened on a list to frame (a shared list), or on a
    // search: someone arriving at "Vegan food in Busan" from a search
    // engine, or by a shared link, was shown Seoul with no pins in it.
    // Not when it opens on a place (a reload of /place/x#q=Busan): the
    // map is on that place, and framing the search took its pin away.
    if (first.current) {
      first.current = false;
      if (placeOpen || (!fitAll && !searchQuery.trim())) {
        // …but the search it came with is still to be framed, once the
        // place is closed: the list then read "Busan" over a map of Seoul
        // with no pin in it.
        owed.current = placeOpen && (fitAll || Boolean(searchQuery.trim()));
        return undefined;
      }
    } else if (!closed) {
      owed.current = false;
    }
    if (restaurants.length === 0) return undefined;
    // After a pause in typing, not on every letter: "se", "seo", "seou"
    // each name a different set and the map lurched between them.
    const timer = setTimeout(() => {
    const latlngs = restaurants.map(r => { const c = coordsOf(r); return L.latLng(c.lat, c.lng); });
    const size = map.getSize();
    const overlap = sheetOverlap(map);
    const visible = L.bounds([0, 0], [size.x, Math.max(1, size.y - overlap)]);
    // fitAll ("Saved"): the point is to see the whole shortlist, so frame
    // all of it even when part is already in view.
    // A search that names an area ("itaewon") is framed too: with the map
    // on all of Seoul those places were "in view" as one count of 24, and
    // nothing moved.
    // …but only when the search itself changed. With the same search, a
    // place closing on the minute or one more chip used to throw away the
    // reader's own zoom and pan.
    const searched = framedFor.current !== searchQuery;
    framedFor.current = searchQuery;
    const framed = fitAll || (searched && inArea.length > 0);
    if (!framed && latlngs.some(ll => visible.contains(map.latLngToContainerPoint(ll)))) return;
    safeFlyToBounds(map, latlngs, [56, 56], [56, 56 + overlap], { maxZoom: 15, duration: 0.6 });
    }, searchQuery.trim() ? 400 : 0);
    return () => clearTimeout(timer);
    // key stands in for restaurants: same places, same key, no move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map, fitAll, closed]);
  return null;
}

// Markers are not tab stops (keyboard={false}): at a city view that was
// dozens to hundreds of stops between the search box and the tab bar, each
// reached again in the list, which holds every place on the map and is the
// keyboard and screen-reader route (CRITIQUE-2 #12). Pointer and touch are
// unchanged.
function ClusteredMarkers({ restaurants, selectedId, selectedPlace = null, onMarkerClick, savedIds, stopIds, peek = false }) {
  const map = useMap();
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  // The open place always keeps its own pin, so it never disappears into a
  // count while its detail is on screen.
  // …also when the search or the chips leave it out of the list (a link
  // to a place that carries another search, a saved place opened from
  // the Journal): the open place had no pin, and the map was not moved to it.
  const selected = restaurants.find(r => r.id === selectedId) ?? (selectedPlace?.id === selectedId ? selectedPlace : undefined);
  const savedKey = (savedIds ?? []).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const savedSet = useMemo(() => new Set(savedIds ?? []), [savedKey]);
  const stopKey = (stopIds ?? []).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stopNumber = useMemo(() => new Map((stopIds ?? []).map((id, i) => [id, i + 1])), [stopKey]);
  const stopPlaces = restaurants.filter(r => stopNumber.has(r.id) && r.id !== selectedId);
  const savedPlaces = restaurants.filter(r => savedSet.has(r.id) && !stopNumber.has(r.id) && r.id !== selectedId);
  const groups = useMemo(() => {
    const points = restaurants
      .filter(r => r.id !== selectedId && !savedSet.has(r.id) && !stopNumber.has(r.id))
      .map(r => {
        const c = coordsOf(r);
        const p = map.project([c.lat, c.lng], zoom);
        return { x: p.x, y: p.y, r, latlng: c };
      });
    // Dots are small, so they only need grouping when they would touch;
    // pins are tall and need the wider radius.
    return clusterPoints(points, zoom < DOT_BELOW_ZOOM ? DOT_CLUSTER_RADIUS_PX : CLUSTER_RADIUS_PX);
  }, [restaurants, selectedId, zoom, map, savedSet, stopNumber]);

  const atMaxZoom = zoom >= map.getMaxZoom();

  // From 768px up the detail docks beside the map, so bring an opened place
  // into view if it is off screen. Not on a phone, where the detail covers
  // the map and a pan would only reshuffle the list behind it.
  useEffect(() => {
    if (!selected || !window.matchMedia?.('(min-width: 768px)').matches) return;
    const c = coordsOf(selected);
    const ll = L.latLng(c.lat, c.lng);
    // The place panel can lie over the map's left edge (three columns from
    // 1200 px): a pin under it is not in view either. Bring it to the
    // middle of the part of the map still showing.
    const covered = dockCover(map);
    const p = map.latLngToContainerPoint(ll);
    const size = map.getSize();
    const margin = 48;
    const inView = p.x >= covered + margin && p.x <= size.x - margin && p.y >= margin && p.y <= size.y - margin;
    if (!inView) map.panBy([p.x - (covered + (size.x - covered) / 2), p.y - size.y / 2]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // On a phone the place opens half way up from its pin: the pin has to be
  // in the strip of map left above it. Moved only when it is not (a pin
  // pressed low on the screen with the list folded away).
  useEffect(() => {
    if (!selected || !peek) return undefined;
    const timer = setTimeout(() => {
      const sheet = document.querySelector('.detail-sheet--peek');
      if (!sheet) return;
      const box = map.getContainer().getBoundingClientRect();
      // offsetHeight, not the drawn box: the sheet is still sliding up.
      const foot = window.innerHeight - sheet.offsetHeight - box.top;
      const c = coordsOf(selected);
      const p = map.latLngToContainerPoint([c.lat, c.lng]);
      const size = map.getSize();
      if (foot < 120) return;
      // The open place's pin is 49 px tall above its point.
      if (p.y >= 64 && p.y <= foot - 14 && p.x >= 28 && p.x <= size.x - 28) return;
      try {
        map.panBy([p.x - size.x / 2, p.y - Math.round(foot * 0.62)], { animate: !reduceMotion(), duration: 0.35 });
      } catch { /* leave the map where it is */ }
    }, 80);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, peek]);

  return (
    <>
      {groups.map(members => {
        if (members.length === 1) {
          const { r, latlng } = members[0];
          return (
            <Marker
              key={r.id}
              position={[latlng.lat, latlng.lng]}
              icon={zoom < DOT_BELOW_ZOOM ? dotIcon(r) : pinIcon(r, false)}
              keyboard={false}
              title={pinLabel(r)}
              alt={pinLabel(r)}
              eventHandlers={{ click: () => onMarkerClick(r) }}
            />
          );
        }
        const latlngs = members.map(m => m.latlng);
        const lat = latlngs.reduce((a, c) => a + c.lat, 0) / latlngs.length;
        const lng = latlngs.reduce((a, c) => a + c.lng, 0) / latlngs.length;
        const key = 'c:' + members.map(m => m.r.id).join(',');
        // Zooming cannot separate places that share a building, so list
        // them instead.
        if (atMaxZoom || isSameSpot(latlngs)) {
          const label = t('map.clusterList', { count: members.length });
          return (
            <Marker key={key} position={[lat, lng]} icon={clusterIcon(members.length)} keyboard={false} title={label} alt={label}>
              <Popup className="k-cluster-popup" closeButton={false} maxHeight={220}>
                <p className="k-cluster-popup__title">{label}</p>
                <ul>
                  {members.map(({ r }) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => { map.closePopup(); onMarkerClick(r); }}>
                        {r.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </Popup>
            </Marker>
          );
        }
        const label = t('map.clusterZoom', { count: members.length });
        return (
          <Marker
            key={key}
            position={[lat, lng]}
            icon={clusterIcon(members.length)}
            keyboard={false}
            title={label}
            alt={label}
            eventHandlers={{
              click: () => {
                const points = latlngs.map(c => [c.lat, c.lng]);
                const overlap = sheetOverlap(map);
                // The strip above the sheet is small: fitted into it, some
                // groups came out at the zoom the map was already on, and
                // the tap did nothing at all. A tap always goes one step
                // closer at least, around the group that was tapped.
                let fits = NaN;
                try { fits = map.getBoundsZoom(L.latLngBounds(points), false, L.point(112, 112 + overlap)); } catch { /* no room to measure */ }
                if (!(fits > map.getZoom())) {
                  map.setZoomAround([lat, lng], Math.min(map.getMaxZoom(), map.getZoom() + 1), { animate: !reduceMotion() });
                  return;
                }
                safeFlyToBounds(map, points, [56, 56], [56, 56 + overlap], {
                  maxZoom: map.getMaxZoom(),
                  duration: 0.5,
                });
              },
            }}
          />
        );
      })}
      {savedPlaces.map((r, i) => {
        const c = coordsOf(r);
        const label = `${pinLabel(r)} · ${t('filters.savedOnly')}`;
        // How many earlier hearts sit on this one at the current zoom.
        const p = map.project([c.lat, c.lng], zoom);
        const shift = savedPlaces.slice(0, i).filter(o => {
          const oc = coordsOf(o);
          return map.project([oc.lat, oc.lng], zoom).distanceTo(p) < HEART_OVERLAP_PX;
        }).length;
        return (
          <Marker
            key={`saved:${r.id}`}
            position={[c.lat, c.lng]}
            icon={savedIcon(shift)}
            keyboard={false}
            zIndexOffset={500}
            title={label}
            alt={label}
            eventHandlers={{ click: () => onMarkerClick(r) }}
          />
        );
      })}
      {stopPlaces.map(r => {
        const c = coordsOf(r);
        const n = stopNumber.get(r.id);
        const label = `${t('detail.journeyPrev', { index: n })} · ${pinLabel(r)}`;
        return (
          <Marker
            key={`stop:${r.id}`}
            position={[c.lat, c.lng]}
            icon={stopIcon(n)}
            keyboard={false}
            // Earlier stops on top where two share a corner.
            zIndexOffset={700 - n}
            title={label}
            alt={label}
            eventHandlers={{ click: () => onMarkerClick(r) }}
          />
        );
      })}
      {selected && (
        <Marker
          key={selected.id}
          position={[coordsOf(selected).lat, coordsOf(selected).lng]}
          // A journey's stop keeps its number while it is the one open:
          // as a plain pin, which stop it was could no longer be told.
          icon={stopNumber.has(selected.id) ? stopIcon(stopNumber.get(selected.id), true) : pinIcon(selected, true)}
          keyboard={false}
          title={pinLabel(selected)}
          alt={pinLabel(selected)}
          zIndexOffset={1000}
          eventHandlers={{ click: () => onMarkerClick(selected) }}
        />
      )}
    </>
  );
}

// The visitor's own position: a blue dot, the one mark on the map that is
// not a place, so it uses the one colour no place uses. The ring is the
// accuracy the device reported; a coarse fix (desktop Wi-Fi, kilometres
// off) is drawn hollow and named "about here".
const youIcon = (coarse) => L.divIcon({
  className: `k-you${coarse ? ' k-you--coarse' : ''}`,
  html: '<span aria-hidden="true"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});
const YOU_ICON = youIcon(false);
const YOU_ICON_COARSE = youIcon(true);

function UserLocation({ location }) {
  const map = useMap();
  const { t } = useTranslation();
  const at = location?.at;
  // Go there on every answer (the button pressed again brings the map
  // back), fitted into the part of the map the list sheet leaves showing.
  useEffect(() => {
    if (!location) return;
    safeFlyToBounds(map, [[location.lat, location.lng]], [56, 56], [56, 56 + sheetOverlap(map)], { maxZoom: 15, duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, map]);
  if (!location) return null;
  const coarse = isCoarse(location);
  const label = coarse ? t('map.youAreAbout') : t('map.youAreHere');
  return (
    <>
      {location.accuracy > 30 && (
        <Circle
          center={[location.lat, location.lng]}
          radius={location.accuracy}
          interactive={false}
          pathOptions={{ color: '#1D6FE0', weight: 1, opacity: 0.5, fillColor: '#1D6FE0', fillOpacity: 0.08 }}
        />
      )}
      <Marker
        position={[location.lat, location.lng]}
        icon={coarse ? YOU_ICON_COARSE : YOU_ICON}
        keyboard={false}
        interactive={false}
        zIndexOffset={900}
        title={label}
        alt={label}
      />
    </>
  );
}

const LOCATE_MESSAGE = {
  denied: 'map.locateDenied',
  unavailable: 'map.locateUnavailable',
  outside: 'map.locateOutside',
};

// "My location" button, outside the Leaflet container so it is an ordinary
// button in the page's tab order. What happened is said in words beside it
// (and to screen readers), not only by the dot appearing.
// "+" and "−". Pinching needs two hands, and a double tap only zooms in:
// someone holding a bag or a child had no way to zoom out. Under the "my
// location" button, the same size.
// The middle of the map that can be seen: the list covers its lower part on
// a phone and its left side when the phone is turned. Zooming on the
// middle of the whole map — a point under the list — carried what was
// being looked at out of view.
function visiblePoint(map) {
  const size = map.getSize();
  const m = map.getContainer().getBoundingClientRect();
  const sheet = (document.querySelector('.detail-sheet--peek') ?? document.querySelector('.sidebar-region'))?.getBoundingClientRect();
  let x = size.x / 2;
  let y = size.y / 2;
  if (sheet && sheet.width > 0 && sheet.height > 0) {
    const acrossWidth = sheet.left <= m.left + 1 && sheet.right >= m.right - 1;
    // (Most of the way down: the tab bar under it is 64 px plus the
    // phone's home-indicator inset.)
    const acrossHeight = sheet.top <= m.top + 1 && sheet.bottom >= m.bottom - m.height * 0.4;
    if (acrossWidth && sheet.top > m.top && sheet.top < m.bottom) y = (sheet.top - m.top) / 2;
    else if (acrossHeight && sheet.right > m.left && sheet.right < m.right) {
      x = (sheet.right - m.left) + (m.right - sheet.right) / 2;
      // …and above the tab bar, which lies over the map's foot there.
      y = (Math.min(sheet.bottom, m.bottom) - m.top) / 2;
    }
  }
  // A place open beside the list on a wide screen lies over the map's left.
  const docked = document.querySelector('.detail-sheet--docked')?.getBoundingClientRect();
  if (docked && docked.width > 0 && docked.right > m.left && docked.right < m.right && docked.left <= m.left + 1) {
    x = (docked.right - m.left) + (m.right - docked.right) / 2;
  }
  return L.point(x, y);
}
function zoomBy(map, step) {
  if (!map) return;
  const zoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + step));
  if (zoom === map.getZoom()) return;
  map.setZoomAround(map.containerPointToLatLng(visiblePoint(map)), zoom, { animate: !reduceMotion() });
}

// The part of the map that can be seen, as a box of coordinates: the same
// part visiblePoint() takes the middle of.
function visibleBox(map) {
  const size = map.getSize();
  const c = visiblePoint(map);
  const hw = Math.min(c.x, size.x - c.x);
  const hh = Math.min(c.y, size.y - c.y);
  const a = map.containerPointToLatLng([c.x - hw, c.y + hh]);
  const b = map.containerPointToLatLng([c.x + hw, c.y - hh]);
  return { s: a.lat, w: a.lng, n: b.lat, e: b.lng };
}
const sameBox = (a, b) => Boolean(a && b) && ['s', 'w', 'n', 'e'].every(k => Math.abs(a[k] - b[k]) < 1e-7);

// "Search this area": the list holds every place in the country, nearest
// first, whatever part of it the map shows. Once the map has been moved
// by hand, this narrows the list to what is on it. Offered only when that
// would change the list: some of its places in view and some not.
function SearchAreaButton({ mapRef, touched, restaurants, mapBox, onSearchArea, hidden }) {
  const { t } = useTranslation();
  const [offer, setOffer] = useState(false);
  const offered = useRef(false);
  const latest = useRef({ restaurants, mapBox });
  latest.current = { restaurants, mapBox };
  const check = useRef(() => {});
  useEffect(() => {
    let map = null;
    const byHand = () => { touched.current = true; };
    // Only the move a hand made is asked about: a pin pressed afterwards
    // moves the map by itself, and that is not a reason to offer.
    // Asked once the gesture has settled: a drag that turns into a pinch
    // ends twice, and the first end is not where the map comes to rest.
    let settle = null;
    const moved = () => {
      if (!touched.current) return;
      clearTimeout(settle);
      settle = setTimeout(() => { touched.current = false; read(); }, 350);
    };
    const read = () => {
      const now = latest.current;
      const box = visibleBox(map);
      let inside = 0;
      for (const r of now.restaurants) {
        const c = coordsOf(r);
        if (c.lat >= box.s && c.lat <= box.n && c.lng >= box.w && c.lng <= box.e) inside += 1;
      }
      const next = inside > 0 && inside < now.restaurants.length && !sameBox(box, now.mapBox);
      offered.current = next;
      setOffer(next);
    };
    // The map is created after this first render.
    const wait = setInterval(() => {
      map = mapRef.current;
      if (!map) return;
      clearInterval(wait);
      check.current = read;
      map.on('moveend', moved);
      map.on('dragstart', byHand);
      map.on('dblclick', byHand);
    }, 200);
    return () => { clearInterval(wait); clearTimeout(settle); check.current = () => {}; map?.off('moveend', moved); map?.off('dragstart', byHand); map?.off('dblclick', byHand); };
  }, [mapRef, touched]);
  // A chip or a search changes what is listed without moving the map.
  // …which can only take the offer away (it is not a move by hand).
  useEffect(() => { if (offered.current) check.current(); }, [restaurants, mapBox]);
  if (!offer || hidden) return null;
  return (
    <button
      type="button"
      className="map-area-btn"
      onClick={() => {
        const map = mapRef.current;
        if (!map) return;
        offered.current = false;
        setOffer(false);
        onSearchArea(visibleBox(map));
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
      {t('map.searchArea')}
    </button>
  );
}

// A press on the bare map (not on a pin, which does not reach the map).
// Acted on a moment later: the first tap of a double tap (zoom in) is a
// click too, and two quick taps must not close twice.
function MapClicks({ onMapClick, selectedId }) {
  const timer = useRef(null);
  // …and not the place a pin opened in that moment.
  const open = useRef(selectedId);
  open.current = selectedId;
  const cancel = () => { clearTimeout(timer.current); timer.current = null; };
  useMapEvents({
    click: () => { cancel(); const was = open.current; timer.current = setTimeout(() => { timer.current = null; if (open.current === was) onMapClick(); }, 280); },
    dblclick: cancel,
    zoomstart: cancel,
    dragstart: cancel,
  });
  useEffect(() => cancel, []);
  return null;
}

function ZoomButtons({ mapRef, onUse }) {
  const { t } = useTranslation();
  // At the end of the range a button shows that it has nothing left to do
  // (still focusable: a keyboard does not lose its place when it gets there).
  const [edge, setEdge] = useState(null);
  useEffect(() => {
    let map = null;
    const read = () => {
      const z = map.getZoom();
      setEdge(z <= map.getMinZoom() ? 'min' : z >= map.getMaxZoom() ? 'max' : null);
    };
    // The map is created after this first render.
    const wait = setInterval(() => {
      map = mapRef.current;
      if (!map) return;
      clearInterval(wait);
      map.on('zoomend', read);
      read();
    }, 200);
    return () => { clearInterval(wait); map?.off('zoomend', read); };
  }, [mapRef]);
  return (
    <div className="map-zoom">
      <button type="button" className="map-zoom__btn" aria-label={t('map.zoomIn')} title={t('map.zoomIn')} aria-disabled={edge === 'max' || undefined} onClick={() => { onUse?.(); zoomBy(mapRef.current, 1); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <button type="button" className="map-zoom__btn" aria-label={t('map.zoomOut')} title={t('map.zoomOut')} aria-disabled={edge === 'min' || undefined} onClick={() => { onUse?.(); zoomBy(mapRef.current, -1); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
      </button>
    </div>
  );
}

function LocateControl({ state, location, onLocate, onMessage }) {
  const { t } = useTranslation();
  const answerKey = LOCATE_MESSAGE[state] ?? (state === 'located' && isCoarse(location) ? 'map.locateCoarse' : null);
  const asking = state === 'asking';
  // The message covers part of the map, so it leaves after a few seconds;
  // pressing the button again says it again.
  const [shown, setShown] = useState(true);
  const at = location?.at;
  useEffect(() => {
    setShown(true);
    if (!answerKey) return undefined;
    const id = setTimeout(() => setShown(false), 8000);
    return () => clearTimeout(id);
  }, [state, at, answerKey]);
  const messageKey = shown ? answerKey : null;
  // The map's other button steps aside only while the message is up.
  const saying = asking || Boolean(messageKey);
  useEffect(() => { onMessage?.(saying); }, [saying, onMessage]);
  return (
    <div className="map-locate">
      <p className="map-locate__status" role="status">
        {asking ? <span className="visually-hidden">{t('map.locateAsking')}</span> : messageKey && <span className="map-locate__message">{t(messageKey)}</span>}
      </p>
      <button
        type="button"
        // Until it has been used the button says what it is for: a bare
        // crosshair in the corner was the only way to "near me", and a
        // first-time visitor did not read it as one.
        className={`map-locate__btn${state === 'located' ? ' is-on' : ''}${asking ? ' is-asking' : ''}${state === 'idle' ? ' has-label' : ''}`}
        onClick={onLocate}
        // Named by the words on it while they show (voice control says what it reads).
        aria-label={state === 'located' ? t('map.locateAgain') : state === 'idle' ? t('map.nearMe') : t('map.locate')}
        title={state === 'located' ? t('map.locateAgain') : t('map.locate')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
        {state === 'idle' && <span className="map-locate__label" aria-hidden="true">{t('map.nearMe')}</span>}
      </button>
    </div>
  );
}

// Memoised: every map move sets the list's sort centre in App, which
// re-rendered this whole tree — hundreds of markers reconciled and their
// handlers rebound — to draw exactly what was already there. App hands it
// stable callbacks (useStableCallback) so the comparison holds.
function retryTile(e) {
  const tile = e.tile;
  const tries = Number(tile?.dataset?.retry ?? 0);
  if (!tile || tries >= 2) return;
  tile.dataset.retry = String(tries + 1);
  const src = tile.src;
  setTimeout(() => { if (tile.isConnected) tile.src = src; }, tries === 0 ? 2000 : 6000);
}

export default React.memo(MapComponent);

function MapComponent({
  restaurants, onMarkerClick, selectedId, selectedPlace = null, onCenterChange, searchQuery = '',
  userLocation = null, locateState = 'idle', onLocate, fitAll = false, savedIds = [], stopIds = [], sheetState = 1,
  placePeek = false, onMapClick, mapBox = null, onSearchArea,
}) {
  const mapRef = useRef(null);
  // Whether the map has been moved by hand yet (a drag, a pinch, the wheel,
  // a double tap, its zoom buttons): only then is "Search this area"
  // offered — not after a pin was pressed and the map moved itself.
  const touched = useRef(false);
  const [locateSaying, setLocateSaying] = useState(false);
  const touch = () => { touched.current = true; };
  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }} onTouchStartCapture={(e) => { if (e.touches.length > 1) touch(); }} onWheelCapture={touch}>
      {onLocate && <LocateControl state={locateState} location={userLocation} onLocate={onLocate} onMessage={setLocateSaying} />}
      <ZoomButtons mapRef={mapRef} onUse={touch} />
      {onSearchArea && (
        <SearchAreaButton
          mapRef={mapRef}
          touched={touched}
          restaurants={restaurants}
          mapBox={mapBox}
          onSearchArea={onSearchArea}
          // Not over a place, not while the list is whole by design, and
          // not beside the location button's own message — while it is
          // showing: hidden for as long as the answer stood ("denied"), the
          // button was gone for the rest of the visit.
          hidden={Boolean(selectedId) || fitAll || locateSaying}
        />
      )}
      <MapContainer ref={mapRef} center={MAP_CENTER} zoom={12} minZoom={6} maxBounds={KOREA_AND_AROUND} maxBoundsViscosity={0.6} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
        {/* Top right, not Leaflet's bottom right: on a phone the list sheet
            and tab bar cover the map's bottom edge, which hid the
            OpenStreetMap credit its licence requires. */}
        <AttributionControl position="topright" prefix={false} />
        {onCenterChange && <CenterReporter onCenterChange={onCenterChange} sheetState={sheetState} userLocation={userLocation} />}
        <ResizeSync />
        <MapA11y />
        {onMapClick && <MapClicks onMapClick={onMapClick} selectedId={selectedId} />}
        {/* This attribution is legally required credit markup for OpenStreetMap,
            not UI copy, so it stays hardcoded rather than moving to i18n.

            OpenStreetMap's own tiles, not CARTO's. CARTO withdrew keyless access
            to basemaps.cartocdn.com: the request still answers 200, but the body
            is a ~2 KB "API KEY REQUIRED" watermark instead of a ~38 KB tile, so
            the map degraded silently in production with nothing in the console.
            Measured 2026-09-28 against light_all/12/3494/1585.png.

            No {s} subdomain: OSM deprecated the a/b/c prefixes and asks for the
            single tile.openstreetmap.org host over HTTP/2. This is the standard
            tile layer, which OSM provides on a usage policy aimed at modest
            traffic, not a commercial CDN — if this app's traffic ever grows,
            move to a keyed provider rather than leaning harder on a donation. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          // Asked for with CORS (the tile server allows any origin), so the
          // service worker caches real responses. Without it they are opaque,
          // and a browser counts each opaque response as megabytes of quota.
          crossOrigin="anonymous"
          // A tile lost in a tunnel stayed a grey square until the map was
          // moved: it is asked for again, twice, a little later each time.
          eventHandlers={{ tileerror: retryTile }}
        />
        <StartInView />
        <UserLocation location={userLocation} />
        <FollowResults restaurants={restaurants} searchQuery={searchQuery} fitAll={fitAll} placeOpen={Boolean(selectedId)} />
        <ClusteredMarkers
          selectedPlace={selectedPlace}
          restaurants={restaurants}
          selectedId={selectedId}
          onMarkerClick={onMarkerClick}
          savedIds={savedIds}
          stopIds={stopIds}
          peek={placePeek}
        />
      </MapContainer>
    </div>
  );
}
