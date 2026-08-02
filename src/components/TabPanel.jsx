import React from 'react';
import { SparkleIcon, UserIcon, ChevronRightIcon, HeartIcon } from './Icons';
import { restaurants } from '../data/restaurants';
import PlaceImage from './PlaceImage';

// Pick some interesting stories for Discover
const cultureStories = [
  restaurants.find(r => r.name.includes('Balwoo')), // Temple Cuisine
  restaurants.find(r => r.name.includes('Myeongdong Kyoja')), // Noodles/Kimchi
  restaurants.find(r => r.name.includes('Gwangjang')), // Street Food
  restaurants.find(r => r.name.includes('Jungsik')), // Modern Korean
].filter(Boolean);

function DiscoverTab({ onNavigate }) {
  return (
    <section className="tab-panel discover-panel">
      <div className="tab-panel-header">
        <span className="panel-icon" aria-hidden="true"><SparkleIcon size={24} /></span>
        <h2>Culture Hub</h2>
        <p>Explore the history and traditions behind Korean food.</p>
      </div>
      
      <div className="story-grid">
        {cultureStories.map(place => (
          <article key={place.id} className="story-card" onClick={() => onNavigate('map')}>
            <PlaceImage place={place} variant="hero" className="story-card-img" />
            <div className="story-card-content">
              <h3>{place.name.split('(')[0].trim()}</h3>
              <p>{place.story.split('.')[0] + '.'}</p>
              <button className="story-card-btn">Read Story <ChevronRightIcon size={14} /></button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProfileTab({ onNavigate }) {
  const settings = [
    { label: 'Language', value: 'English', icon: '🌐' },
    { label: 'Food Preferences', value: 'Not set', icon: '🍲' },
    { label: 'Dietary Preferences', value: 'Not set', icon: '🌱' },
    { label: 'Saved Places', value: 'View Journal', icon: '❤️', action: () => onNavigate('journal') },
    { label: 'About K-Food Map', value: 'v1.0', icon: 'ℹ️' },
    { label: 'Privacy Policy', value: '', icon: '🔒' },
  ];

  return (
    <section className="tab-panel profile-panel">
      <div className="tab-panel-header">
        <span className="panel-icon" aria-hidden="true"><UserIcon size={24} /></span>
        <h2>Settings</h2>
        <p>Manage your preferences and app settings.</p>
      </div>

      <div className="settings-list">
        {settings.map((item, idx) => (
          <div key={idx} className="settings-item" onClick={item.action}>
            <span className="settings-icon">{item.icon}</span>
            <div className="settings-text">
              <span className="settings-label">{item.label}</span>
            </div>
            {item.value && <span className="settings-value">{item.value}</span>}
            <ChevronRightIcon size={18} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TabPanel({ tab, onNavigate }) {
  if (tab === 'discover') return <DiscoverTab onNavigate={onNavigate} />;
  if (tab === 'profile') return <ProfileTab onNavigate={onNavigate} />;
  return null;
}
