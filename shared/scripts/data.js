// Shared data loaders (reusable across the whole app)

let _customerCache = null;

/**
 * Load customerset.json from a global path.
 * Cached in-memory to avoid repeated network fetches.
 */
export async function loadCustomerSet() {
  if (_customerCache) return _customerCache;
  const res = await fetch('/data/customerset.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load /data/customerset.json');
  _customerCache = await res.json();
  return _customerCache;
}
