import React from 'react';
import { HeartIcon } from './Icons';

export default function BottomSheetList({ restaurants, onRestaurantClick, bookmarkedIds }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 'var(--tab-h)', /* sits on top of the tab bar */
      left: 0,
      right: 0,
      height: '35vh',
      backgroundColor: 'rgba(247, 245, 233, 0.85)', /* #F7F5E9 semi-transparent */
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderTopLeftRadius: '24px',
      borderTopRightRadius: '24px',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 0 0 0'
    }}>
      {/* Handle */}
      <div style={{
        width: '40px',
        height: '4px',
        backgroundColor: 'rgba(122, 145, 124, 0.4)',
        borderRadius: '2px',
        margin: '0 auto 16px',
        flexShrink: 0
      }} />

      <div style={{ padding: '0 20px', marginBottom: '12px', flexShrink: 0 }}>
        <h3 className="serif-title" style={{ fontSize: '1.2rem', color: 'var(--text-dark)' }}>
          Found {restaurants.length} places
        </h3>
      </div>

      <div className="no-scrollbar" style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '0 20px 20px 20px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px' 
      }}>
        {restaurants.map(r => (
          <div
            key={r.id}
            onClick={() => onRestaurantClick(r)}
            style={{
              backgroundColor: 'var(--white)',
              borderRadius: '16px',
              padding: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
              cursor: 'pointer',
              position: 'relative',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}
          >
            {/* Bookmark Icon */}
            {bookmarkedIds.includes(r.id) && (
              <span style={{ position: 'absolute', top: '12px', right: '12px', color: 'var(--gold-accent)' }}>
                <HeartIcon size={16} filled />
              </span>
            )}

            <img
              src={r.image}
              alt=""
              style={{
                width: '64px',
                height: '64px',
                flexShrink: 0,
                borderRadius: '12px',
                objectFit: 'cover',
                backgroundColor: 'var(--sage-green-light)'
              }}
            />

            <div style={{ minWidth: 0 }}>
              <h4 className="serif-title" style={{ fontSize: '1.1rem', color: 'var(--text-dark)', marginBottom: '2px', paddingRight: '24px' }}>
                {r.name.split('(')[0].trim()}
              </h4>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-light)' }}>{r.zone}</span>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span style={{ color: 'var(--gold-accent)' }}>★</span>
                <span style={{ fontWeight: 600 }}>{r.rating}</span>
                <span style={{ color: 'var(--text-light)' }}>({r.reviews})</span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {r.tags.map(tag => (
                  <span key={tag} className="tag-chip">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
        {restaurants.length === 0 && (
          <p style={{ color: 'var(--text-light)', textAlign: 'center', marginTop: '20px' }}>No restaurants match your filters.</p>
        )}
      </div>
    </div>
  );
}
