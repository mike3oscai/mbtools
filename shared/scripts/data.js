// Shared data loaders (reusable across the whole app)

let _customerCache = null;
let _productCache = null;

/** Load customerset.json once (cached in memory). */
export async function loadCustomerSet() {
  if (_customerCache) return _customerCache;
  const res = await fetch('/data/customerset.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load /data/customerset.json');
  _customerCache = await res.json();
  return _customerCache;
}

/** Load productset.json once (cached in memory). */
export async function loadProductSet() {
  if (_productCache) return _productCache;
  const res = await fetch('/data/productset.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load /data/productset.json');
  _productCache = await res.json();
  return _productCache;
}
let _vatCache = null;

/** Load vatset.json once (cached in memory). */
export async function loadVatSet() {
  if (_vatCache) return _vatCache;
  const res = await fetch('/data/vatset.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load /data/vatset.json');
  _vatCache = await res.json();
  return _vatCache;
}
