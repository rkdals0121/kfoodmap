import React from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';

// Teardrop pin: cream body with gold outline, gold body when selected
const pinIcon = (selected) => L.divIcon({
  className: 'k-pin',
  html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 42.5C17 42.5 31.5 26.4 31.5 15.6C31.5 7.6 25 1.5 17 1.5C9 1.5 2.5 7.6 2.5 15.6C2.5 26.4 17 42.5 17 42.5Z"
      fill="${selected ? '#C29E65' : '#FDFAF1'}" stroke="${selected ? '#A9854F' : '#C29E65'}" stroke-width="2.5"/>
    <circle cx="17" cy="15.8" r="5" fill="${selected ? '#FDFAF1' : '#7A917C'}"/>
  </svg>`,
  iconSize: [34, 44],
  iconAnchor: [17, 42],
});

export default function MapComponent({ restaurants, onMarkerClick, selectedId }) {
  // Frames the Seoul cluster (Jongno down to Itaewon); Incheon is a short pan away
  const center = [37.5540, 126.9880];

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
      <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {restaurants.map(r => (
          <Marker
            key={r.id}
            position={[r.lat, r.lng]}
            icon={pinIcon(selectedId === r.id)}
            eventHandlers={{
              click: () => onMarkerClick(r),
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
