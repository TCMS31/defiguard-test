/**
 * A minimal in-memory stand-in for the Storage interface, for tests and for the
 * screenshot script.
 *
 * @returns {Storage & { snapshot: () => Record<string, string> }}
 */
export function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));

  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
    snapshot: () => Object.fromEntries(map),
  };
}
