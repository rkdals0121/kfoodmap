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

  componentDidCatch(error) {
    console.error('App failed', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="app-error" role="alert">
          <p>{i18next.t('app.crashed')}</p>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>{i18next.t('app.reload')}</button>
          <a href="/">K-Food Map</a>
        </div>
      );
    }
    return this.props.children;
  }
}
