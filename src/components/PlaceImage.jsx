import React, { useState } from 'react';

const getInitials = (name) => {
  const cleanName = name.split('(')[0].trim();
  return cleanName.substring(0, 1);
};

// Scalable image slot for a place. Renders real photography (photo/coverImage)
// when available; until then, a designed placeholder built from the place's
// illustration. Swapping in real photos later means filling the data fields —
// no component changes.
export default function PlaceImage({ place, variant = 'thumb', className = '', onClick }) {
  const real = place.photo || place.coverImage || null;
  const [failed, setFailed] = useState(false);
  const showReal = real && !failed;

  return (
    <div className={`place-image place-image--${variant} ${className}`} onClick={onClick}>
      {showReal ? (
        // real photos are heavier — lazy-load them
        <img src={real} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        // Premium fallback instead of a blank box
        <div className="place-image__fallback">
          <div className="fallback-bg"></div>
          <span className="fallback-initial">{getInitials(place.name)}</span>
          <img className="fallback-illustration" src={place.image} alt="" />
        </div>
      )}
    </div>
  );
}
