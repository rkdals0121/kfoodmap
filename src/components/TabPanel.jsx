import React from 'react';

export default function TabPanel({ tab }) {
  const copy = {
    discover: {
      title: 'Discover',
      body: "Stories behind Korea's sustainable table — temple cuisine, slow fermentation, zero-waste dining. Arriving in the next update.",
    },
    profile: {
      title: 'Profile',
      body: 'Dietary preferences, language and saved filters will live here.',
    },
  }[tab];

  if (!copy) return null;

  return (
    <section className="tab-panel">
      <h2>{copy.title}</h2>
      <div className="panel-rule" />
      <p>{copy.body}</p>
    </section>
  );
}
