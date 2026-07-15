import React from 'react';
import { SparkleIcon, UserIcon, ChevronRightIcon } from './Icons';

// Discover and Profile stay intentionally light — placeholders that point
// back to the core Discover-map -> Detail -> Journal loop rather than
// competing with it.
const PANELS = {
  discover: {
    Icon: SparkleIcon,
    title: 'Discover',
    body: 'Every restaurant page holds a piece of Korea — how temple monks eat, where jajangmyeon began, why fermentation matters. Curated reads are coming soon.',
    linkLabel: 'Explore the map',
    linkTo: 'map',
  },
  profile: {
    Icon: UserIcon,
    title: 'Profile',
    body: 'Dietary filters already work from the map — Vegan, Halal, Mild Taste and more. Preferences and language settings are coming soon.',
    linkLabel: 'View your Journal',
    linkTo: 'journal',
  },
};

export default function TabPanel({ tab, onNavigate }) {
  const panel = PANELS[tab];
  if (!panel) return null;
  const { Icon, title, body, linkLabel, linkTo } = panel;

  return (
    <section className="tab-panel">
      <span className="panel-icon" aria-hidden="true"><Icon size={22} /></span>
      <h2>{title}</h2>
      <p>{body}</p>
      <button className="panel-link" onClick={() => onNavigate(linkTo)}>
        {linkLabel} <ChevronRightIcon size={16} />
      </button>
    </section>
  );
}
