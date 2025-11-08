/* dataService.js
   Load JSON catalogs from ../../data relative to this module.
   Normalize Program/RAM/ROM keys case-insensitively and with aliases.
*/

let customers = [];
let products = [];          // raw
let catalogNormalized = []; // [{ program, ram, rom }, ...]

const DATA_BASE = new URL("../../data/", import.meta.url);
const CUSTOMERS_URL = new URL("customerset.json", DATA_BASE);
const PRODUCTS_URL  = new URL("productset.json",  DATA_BASE);

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed ${url}: ${res.status}`);
  return res.json();
}

export async function loadDatasets() {
  const [c, p] = await Promise.all([
    fetchJson(CUSTOMERS_URL).catch(() => []),
    fetchJson(PRODUCTS_URL).catch(() => [])
  ]);
  customers = Array.isArray(c) ? c : [];
  products  = Array.isArray(p) ? p : [];
  catalogNormalized = normalizeCatalog(products);
}

export function getCustomers() { return customers; }
export function getProducts()  { return products;  }           // raw (por si lo necesitas)
export function getCatalog()   { return catalogNormalized; }   // normalizado

/* ---------- helpers ---------- */

function normStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}
function pick(o, candidates) {
  // devuelve el primer valor definido entre una lista de posibles claves (case-insensitive)
  for (const cand of candidates) {
    // búsqueda directa
    if (o && o.hasOwnProperty(cand)) return o[cand];
  }
  // búsqueda case-insensitive
  const lowerMap = {};
  for (const k of Object.keys(o || {})) lowerMap[k.toLowerCase()] = o[k];
  for (const cand of candidates) {
    const hit = lowerMap[cand.toLowerCase()];
    if (hit !== undefined) return hit;
  }
  return undefined;
}

function normalizeCatalog(rows) {
  // Intentamos cubrir variantes comunes de claves usadas históricamente
  const PROG_KEYS = ["Program", "PROGRAM", "program"];
  const RAM_KEYS  = ["RAM", "Ram", "ram", "RAM in GB", "ram_gb"];
  const ROM_KEYS  = ["ROM", "Rom", "rom", "ROM in GB", "Storage", "STORAGE IN GB", "storage_gb"];

  const out = [];
  for (const r of rows || []) {
    const program = normStr(pick(r, PROG_KEYS));
    const ram     = normStr(pick(r, RAM_KEYS));
    const rom     = normStr(pick(r, ROM_KEYS));

    if (!program) continue; // sin programa no sirve para encadenar

    out.push({
      program,
      ram,
      rom
    });
  }
  return out;
}
