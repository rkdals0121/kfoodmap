import React, { useState, useEffect } from 'react';
import { LeafIcon, RouteIcon, CompassIcon, CopyIcon, CheckIcon, HeartIcon } from './Icons';

export default function RestaurantDetail({ restaurant, onClose, isBookmarked, onToggleBookmark }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [restaurant]);

  if (!restaurant) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(restaurant.address)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => console.error('Failed to copy: ', err));
  };

  const handleDirections = () => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${restaurant.lat},${restaurant.lng}`, '_blank');
  };

  return (
    <>
      <div 
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 20,
          animation: 'fadeIn 0.3s ease'
        }}
      />
      
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        backgroundColor: 'var(--bg-cream)',
        borderTopLeftRadius: '32px', borderTopRightRadius: '32px',
        padding: '32px 28px 24px', zIndex: 21,
        boxShadow: '0 -10px 40px rgba(0,0,0,0.15)',
        animation: 'slideUp 0.3s ease-out',
        height: '92vh', // Full screen modal experience
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Close / Drag Handle Area */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', flexShrink: 0, position: 'relative' }}>
          <div style={{ width: '40px', height: '5px', backgroundColor: 'rgba(122, 145, 124, 0.3)', borderRadius: '3px' }} />
          <button 
            onClick={onClose}
            style={{ position: 'absolute', right: 0, top: '-10px', background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-light)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '20px' }} className="no-scrollbar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {restaurant.tags.map(tag => (
                <span key={tag} className="tag-chip tag-chip--lg">{tag}</span>
              ))}
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); onToggleBookmark(restaurant.id); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: isBookmarked ? 'var(--gold-accent)' : 'var(--sage-green-light)',
                transition: 'all 0.2s ease', padding: '0 0 0 10px'
              }}
              aria-label="Bookmark"
            >
              <HeartIcon size={26} filled={isBookmarked} />
            </button>
          </div>

          <h2 className="serif-title" style={{ fontSize: '2rem', marginBottom: '8px', color: 'var(--text-dark)' }}>
            {restaurant.name}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', fontSize: '0.95rem', color: 'var(--text-dark)' }}>
            <span style={{ color: 'var(--text-light)' }}>{restaurant.zone}</span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span style={{ color: 'var(--gold-accent)', fontSize: '1.2rem' }}>★</span>
            <span style={{ fontWeight: 600 }}>{restaurant.rating}</span>
            <span style={{ color: 'var(--text-light)', marginLeft: '4px' }}>({restaurant.reviews} reviews)</span>
          </div>

          <div style={{
            height: '150px', borderRadius: '20px', marginBottom: '16px',
            backgroundColor: 'rgba(122, 145, 124, 0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
          }}>
            <img src={restaurant.image} alt="" style={{ height: '110px', objectFit: 'contain' }} />
          </div>

          {restaurant.hours && (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-light)', marginBottom: '12px' }}>
              Open {restaurant.hours}
            </div>
          )}

          <p style={{ fontStyle: 'italic', fontSize: '1.05rem', color: 'var(--text-light)', marginBottom: '24px', lineHeight: '1.5' }}>
            "{restaurant.vibe}"
          </p>

          <div style={{ padding: '16px', backgroundColor: 'rgba(122, 145, 124, 0.08)', borderRadius: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--sage-green)' }}>
               <LeafIcon size={18} />
               <strong style={{ fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ESG Point</strong>
            </div>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-dark)', lineHeight: '1.5' }}>{restaurant.esg_point}</p>
            <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
               <RouteIcon size={15} />
               <span>Food Mileage:</span>
               <strong style={{ color: 'var(--text-dark)' }}>{restaurant.food_mile} km</strong>
            </div>
          </div>

          {restaurant.menus?.length > 0 && (
            <>
              <h3 className="serif-title" style={{ fontSize: '1.2rem', color: 'var(--sage-green)', marginBottom: '12px' }}>
                Signature Menu
              </h3>
              <div style={{ marginBottom: '24px' }}>
                {restaurant.menus.map(m => (
                  <div key={m.name} style={{
                    display: 'flex', justifyContent: 'space-between', gap: '12px',
                    padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: '0.95rem'
                  }}>
                    <span style={{ color: 'var(--text-dark)' }}>{m.name}</span>
                    <span style={{ color: 'var(--gold-accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>{m.price}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <h3 className="serif-title" style={{ fontSize: '1.2rem', color: 'var(--sage-green)', marginBottom: '12px' }}>
            Sustainable Philosophy
          </h3>
          <p style={{
            fontSize: '1.05rem', lineHeight: '1.6', color: 'var(--text-light)', marginBottom: '32px', fontFamily: 'Outfit, sans-serif'
          }}>
            {restaurant.story}
          </p>
        </div>

        {/* Action Buttons (Side by Side) */}
        <div style={{ flexShrink: 0, display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button 
            onClick={handleDirections}
            style={{
              flex: 1, padding: '16px 12px', backgroundColor: 'var(--gold-accent)',
              color: 'white', border: 'none', borderRadius: '16px',
              fontSize: '0.95rem', fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
              cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 12px rgba(194, 158, 101, 0.25)', fontFamily: 'Outfit, sans-serif'
            }}
          >
            <CompassIcon size={22} />
            Get Directions
          </button>

          <button 
            onClick={handleCopy}
            style={{
              flex: 1, padding: '16px 12px', backgroundColor: copied ? '#6C9472' : 'var(--sage-green)',
              color: 'white', border: 'none', borderRadius: '16px',
              fontSize: '0.95rem', fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
              cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 12px rgba(122, 145, 124, 0.25)', fontFamily: 'Outfit, sans-serif'
            }}
          >
            {copied ? <CheckIcon size={22} /> : <CopyIcon size={22} />}
            {copied ? 'Copied!' : 'Copy Address'}
          </button>
        </div>

      </div>
    </>
  );
}
