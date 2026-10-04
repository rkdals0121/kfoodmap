import React from 'react';
import i18next from 'i18next';

// Around the whole app. A render that throws (a record of an older shape
// from a cache, a browser missing something) used to leave a blank page
// with no way on; this says so and offers the two ways out.
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(_props, before) {
    // What had focus is gone with the screen: put it on the way out.
    if (this.state.failed && !before.failed) this.reload?.focus();
  }

  componentDidCatch(error) {
    console.error('App failed', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="app-error">
          <p role="alert">{i18next.t('app.crashed')}</p>
          <button type="button" className="btn-primary" ref={(el) => { this.reload = el; }} onClick={() => window.location.reload()}>{i18next.t('app.reload')}</button>
          <a href="/">K-Food Map</a>
        </main>
      );
    }
    return this.props.children;
  }
}
