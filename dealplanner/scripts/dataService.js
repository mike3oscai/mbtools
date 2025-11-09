/* dataService.js
   Loads and normalizes external datasets for Deal Planner.
   - Catalog: ../data/productset.json  -> { program, ram, rom }
   - Customers: ../data/customerset.json -> { customerName }
*/

let _catalog = [];
let _catalogLoaded = false;

let _customers = [];
let _customersLoaded = false;

// -------- Helpers de fetch con varios paths candidatos (para servir en distintas raíces) -----
async function fetchJsonWithFallback(paths) {
  let lastErr = null;
  for (const url of paths) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  console.warn("Failed to fetch JSON from any candidate:", paths, "Last error:", lastErr);
  return null;
}

/* ==============================
   PRODUCT CATALOG
   ============================== */
function normalizeCatalogRow(row) {
  const program = row.Program ?? row.program ?? "";
  const ram     = row.RAM     ?? row.ram     ?? "";
  const rom     = row.ROM     ?? row.rom     ?? "";
  return {
    program: String(program).trim(),
    ram: String(ram).trim(),
    rom: String(rom).trim()
  };
}

export async function loadCatalog() {
  if (_catalogLoaded) return _catalog;

  const data = await fetchJsonWithFallback([
    "../data/productset.json",
    "/data/productset.json",
    "../../data/productset.json"
  ]);

  if (!Array.isArray(data)) {
    _catalog = [];
    _catalogLoaded = true;
    return _catalog;
  }

  const normalized = data.map(normalizeCatalogRow).filter(r => r.program || r.ram || r.rom);

  // dedup por combinación program-ram-rom
  const seen = new Set();
  _catalog = normalized.filter(r => {
    const k = `${r.program}||${r.ram}||${r.rom}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  _catalogLoaded = true;
  return _catalog;
}

export function getCatalog() {
  return _catalog;
}

/* ==============================
   CUSTOMERS
   ============================== */
function normalizeCustomerRow(row) {
  const name = row.customerName ?? row.CustomerName ?? row.name ?? "";
  return { customerName: String(name).trim() };
}

export async function loadCustomers() {
  if (_customersLoaded) return _customers;

  const data = await fetchJsonWithFallback([
    "../data/customerset.json",
    "/data/customerset.json",
    "../../data/customerset.json"
  ]);

  if (!Array.isArray(data)) {
    _customers = [];
    _customersLoaded = true;
    return _customers;
  }

  _customers = data
    .map(normalizeCustomerRow)
    .filter(r => r.customerName);

  _customersLoaded = true;
  return _customers;
}

export function getCustomers() {
  return _customers;
}
