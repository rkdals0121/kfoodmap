import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';
import { MAP_CENTER, coordsOf } from '../utils';
import { clusterPoints, isSameSpot } from '../data/cluster';
import { dietaryBadges } from '../data/verification';
import { pinKind } from '../data/pin-kind';

// Reports the map center upward after each pan/zoom so the list can re-sort by distance
function CenterReporter({ onCenterChange }) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onCenterChange([c.lat, c.lng]);
    },
  });
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
  html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 42.5C17 42.5 31.5 26.4 31.5 15.6C31.5 7.6 25 1.5 17 1.5C9 1.5 2.5 7.6 2.5 15.6C2.5 26.4 17 42.5 17 42.5Z"
      fill="${selected ? '#0E9F6E' : '#FFFFFF'}" stroke="${selected ? '#087F5B' : '#0E9F6E'}" stroke-width="2.5"/>
    ${pinGlyph(kind, selected ? '#FFFFFF' : '#087F5B')}
  </svg>`,
  iconSize: [34, 44],
  iconAnchor: [17, 42],
});

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
// A pin's accessible name carries what it says: "EID · Halal-friendly".
const pinLabel = (r) => [r.name, ...dietaryBadges(r).map(b => b.label)].join(' · ');

// Count badge for pins that would overlap at this zoom (see data/cluster.js).
const clusterIcons = new Map();
const clusterIcon = (count) => {
  if (!clusterIcons.has(count)) {
    clusterIcons.set(count, L.divIcon({
      className: 'k-cluster',
      html: `<span>${count}</span>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
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

// When a search or filter leaves nothing on screen — someone types "Busan"
// while the map shows Seoul — move the map to what was found. Only then: if
// any result is already visible, the map stays where the person put it.
function FollowResults({ restaurants }) {
  const map = useMap();
  const key = restaurants.map(r => r.id).join(',');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (restaurants.length === 0) return;
    const latlngs = restaurants.map(r => { const c = coordsOf(r); return L.latLng(c.lat, c.lng); });
    const size = map.getSize();
    const overlap = sheetOverlap(map);
    const visible = L.bounds([0, 0], [size.x, Math.max(1, size.y - overlap)]);
    if (latlngs.some(ll => visible.contains(map.latLngToContainerPoint(ll)))) return;
    map.flyToBounds(L.latLngBounds(latlngs), {
      paddingTopLeft: [56, 56],
      paddingBottomRight: [56, 56 + overlap],
      maxZoom: 15,
      duration: 0.6,
    });
    // key stands in for restaurants: same places, same key, no move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function ClusteredMarkers({ restaurants, selectedId, onMarkerClick }) {
  const map = useMap();
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  // The open place always keeps its own pin, so it never disappears into a
  // count while its detail is on screen.
  const selected = restaurants.find(r => r.id === selectedId);
  const groups = useMemo(() => {
    const points = restaurants
      .filter(r => r.id !== selectedId)
      .map(r => {
        const c = coordsOf(r);
        const p = map.project([c.lat, c.lng], zoom);
        return { x: p.x, y: p.y, r, latlng: c };
      });
    return clusterPoints(points);
  }, [restaurants, selectedId, zoom, map]);

  const atMaxZoom = zoom >= map.getMaxZoom();

  return (
    <>
      {groups.map(members => {
        if (members.length === 1) {
          const { r, latlng } = members[0];
          return (
            <Marker
              key={r.id}
              position={[latlng.lat, latlng.lng]}
              icon={pinIcon(r, false)}
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
            <Marker key={key} position={[lat, lng]} icon={clusterIcon(members.length)} title={label} alt={label}>
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
            title={label}
            alt={label}
            eventHandlers={{
              click: () => map.flyToBounds(L.latLngBounds(latlngs.map(c => [c.lat, c.lng])), {
                paddingTopLeft: [56, 56],
                paddingBottomRight: [56, 56 + sheetOverlap(map)],
                maxZoom: map.getMaxZoom(),
                duration: 0.5,
              }),
            }}
          />
        );
      })}
      {selected && (
        <Marker
          key={selected.id}
          position={[coordsOf(selected).lat, coordsOf(selected).lng]}
          icon={pinIcon(selected, true)}
          title={pinLabel(selected)}
          alt={pinLabel(selected)}
          zIndexOffset={1000}
          eventHandlers={{ click: () => onMarkerClick(selected) }}
        />
      )}
    </>
  );
}

export default function MapComponent({ restaurants, onMarkerClick, selectedId, onCenterChange }) {
  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <MapContainer center={MAP_CENTER} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
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
        <FollowResults restaurants={restaurants} />
        <ClusteredMarkers
          restaurants={restaurants}
          selectedId={selectedId}
          onMarkerClick={onMarkerClick}
        />
      </MapContainer>
    </div>
  );
}
