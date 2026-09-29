import React from 'react';
import i18next from 'i18next';

// If the map throws, show a line in its place and keep the rest of the app
// (list, detail, Journal) working; without this, one bad map call blanked
// the page.
export default class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Map failed', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="map-error" role="status">
          <p>{i18next.t('map.failed')}</p>
          <button type="button" onClick={() => this.setState({ failed: false })}>{i18next.t('map.retry')}</button>
        </div>
      );
    }
    return this.props.children;
  }
}
