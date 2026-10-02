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
function visibleCenter(map) {
  const size = map.getSize();
  return map.containerPointToLatLng([size.x / 2, (size.y - sheetOverlap(map)) / 2]);
}

// Reports the visible centre upward after each pan/zoom so the list can
// re-sort by distance from what is on screen, not from a point hidden
// under the sheet.
function CenterReporter({ onCenterChange }) {
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
const SAVED_ICON = L.divIcon({
  className: 'k-saved',
  html: '<span aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></span>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// A journey's stop: its number in the route, so the order can be read off
// the map. Like a saved place it is never folded into a count.
const STOPS = new Map();
const stopIcon = (n) => {
  if (!STOPS.has(n)) {
    STOPS.set(n, L.divIcon({
      className: 'k-stop',
      html: `<span aria-hidden="true">${n}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    }));
  }
  return STOPS.get(n);
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
  const sheet = document.querySelector('.sidebar-region');
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
function safeFlyToBounds(map, latlngs, padTL, padBR, options) {
  const size = map.getSize();
  if (size.x - padTL[0] - padBR[0] < 40 || size.y - padTL[1] - padBR[1] < 40) return;
  try {
    map.flyToBounds(L.latLngBounds(latlngs), { paddingTopLeft: padTL, paddingBottomRight: padBR, ...options });
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
function FollowResults({ restaurants: all, searchQuery, fitAll = false }) {
  const map = useMap();
  const inArea = all.filter(r => matchesArea(r, searchQuery));
  const restaurants = inArea.length > 0 ? inArea : all;
  const key = restaurants.map(r => r.id).join(',');
  const first = useRef(true);
  useEffect(() => {
    // The first run is the app opening, where the map keeps its start
    // view — unless it opened on a list to frame (a shared list).
    if (first.current) { first.current = false; if (!fitAll) return; }
    if (restaurants.length === 0) return;
    const latlngs = restaurants.map(r => { const c = coordsOf(r); return L.latLng(c.lat, c.lng); });
    const size = map.getSize();
    const overlap = sheetOverlap(map);
    const visible = L.bounds([0, 0], [size.x, Math.max(1, size.y - overlap)]);
    // fitAll ("Saved"): the point is to see the whole shortlist, so frame
    // all of it even when part is already in view.
    if (!fitAll && latlngs.some(ll => visible.contains(map.latLngToContainerPoint(ll)))) return;
    safeFlyToBounds(map, latlngs, [56, 56], [56, 56 + overlap], { maxZoom: 15, duration: 0.6 });
    // key stands in for restaurants: same places, same key, no move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map, fitAll]);
  return null;
}

// Markers are not tab stops (keyboard={false}): at a city view that was
// dozens to hundreds of stops between the search box and the tab bar, each
// reached again in the list, which holds every place on the map and is the
// keyboard and screen-reader route (CRITIQUE-2 #12). Pointer and touch are
// unchanged.
function ClusteredMarkers({ restaurants, selectedId, onMarkerClick, savedIds, stopIds }) {
  const map = useMap();
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  // The open place always keeps its own pin, so it never disappears into a
  // count while its detail is on screen.
  const selected = restaurants.find(r => r.id === selectedId);
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
    if (!map.getBounds().pad(-0.1).contains(ll)) map.panTo(ll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

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
              <Popup className="k-cluster-popup" closeButton={false}>
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
              click: () => safeFlyToBounds(map, latlngs.map(c => [c.lat, c.lng]), [56, 56], [56, 56 + sheetOverlap(map)], {
                maxZoom: map.getMaxZoom(),
                duration: 0.5,
              }),
            }}
          />
        );
      })}
      {savedPlaces.map(r => {
        const c = coordsOf(r);
        const label = `${pinLabel(r)} · ${t('filters.savedOnly')}`;
        return (
          <Marker
            key={`saved:${r.id}`}
            position={[c.lat, c.lng]}
            icon={SAVED_ICON}
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
          icon={pinIcon(selected, true)}
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
function LocateControl({ state, location, onLocate }) {
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
  return (
    <div className="map-locate">
      <p className="map-locate__status" role="status">
        {asking ? <span className="visually-hidden">{t('map.locateAsking')}</span> : messageKey && <span className="map-locate__message">{t(messageKey)}</span>}
      </p>
      <button
        type="button"
        className={`map-locate__btn${state === 'located' ? ' is-on' : ''}${asking ? ' is-asking' : ''}`}
        onClick={onLocate}
        aria-label={state === 'located' ? t('map.locateAgain') : t('map.locate')}
        title={state === 'located' ? t('map.locateAgain') : t('map.locate')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </button>
    </div>
  );
}

export default function MapComponent({
  restaurants, onMarkerClick, selectedId, onCenterChange, searchQuery = '',
  userLocation = null, locateState = 'idle', onLocate, fitAll = false, savedIds = [], stopIds = [],
}) {
  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      {onLocate && <LocateControl state={locateState} location={userLocation} onLocate={onLocate} />}
      <MapContainer center={MAP_CENTER} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
        {/* Top right, not Leaflet's bottom right: on a phone the list sheet
            and tab bar cover the map's bottom edge, which hid the
            OpenStreetMap credit its licence requires. */}
        <AttributionControl position="topright" />
        {onCenterChange && <CenterReporter onCenterChange={onCenterChange} />}
        <ResizeSync />
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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <StartInView />
        <UserLocation location={userLocation} />
        <FollowResults restaurants={restaurants} searchQuery={searchQuery} fitAll={fitAll} />
        <ClusteredMarkers
          restaurants={restaurants}
          selectedId={selectedId}
          onMarkerClick={onMarkerClick}
          savedIds={savedIds}
          stopIds={stopIds}
        />
      </MapContainer>
    </div>
  );
}
