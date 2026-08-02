import { useState, useEffect } from 'react';

// Tracks browser connectivity via the standard online/offline window
// events. Used to show an honest "you're offline" note where the app
// depends on network (the map's tiles) -- everything else (restaurant
// data, routing) works offline regardless, since it's all bundled.
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
