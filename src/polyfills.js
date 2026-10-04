// Two methods the app uses that phones on iOS 15.0–15.3 (and browsers of
// that age) do not have. Without them the first render threw and the page
// stayed white. Imported first in main.jsx, before anything that calls them.

if (!Object.hasOwn) {
  Object.defineProperty(Object, 'hasOwn', {
    value: (object, key) => Object.prototype.hasOwnProperty.call(object, key),
    configurable: true,
    writable: true,
  });
}

function at(index) {
  const n = Math.trunc(index) || 0;
  const i = n < 0 ? this.length + n : n;
  return i < 0 || i >= this.length ? undefined : this[i];
}

for (const proto of [Array.prototype, String.prototype]) {
  if (!proto.at) {
    Object.defineProperty(proto, 'at', { value: at, configurable: true, writable: true });
  }
}
