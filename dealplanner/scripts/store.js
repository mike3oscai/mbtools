/* store.js
   Single source of truth + persistence + computed fields.
*/
import { emit } from "./bus.js";
import { uid, round2, clampPercent2 } from "./utils.js";

const LS_KEY = "dealplanner.draft.v2";

const defaultProduct = () => ({
  product: {
    program: "", ram: "", rom: "", type: "",
    tmcUsd: 0, xRate: 0, tmcEur: 0,
    copyLevy: 0, deee: 0
  },
  pricing: {
    rrp: 0, vatPct: 0, rrpNoVat: 0,
    customerInvoice: 0,
    distributorInvoice: 0,
    retailInvoice: 0,
    tripleNet: 0,
    aurUsd: 0,
    gpPct: 0
  },
  promotions: {
    mode: "on_vat",
    promo1Rrp: 0, promo2Rrp: 0,
    promo1Discount: 0, promo2Discount: 0,
    promo1Soa: 0, promo2Soa: 0,
    promo1SoaManual: false, promo2SoaManual: false,
    promo1Units: 0, promo2Units: 0,
    promo1TotalSoa: 0, promo2TotalSoa: 0,
    totalUnits: 0, totalSoa: 0,
    soaPerBox: 0
  },
  financials: { quantity: 0, grossRevenue: 0, netRevenue: 0, aur: 0, gpPct: 0 }
});

const state = {
  customer: { name: "", frontEnd: 0, backEnd: 0, distributorFee: 0 },
  products: { byId: {}, allIds: [] }
};

/* ----------------- Persistence ----------------- */
export function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);

    if (parsed.products && Array.isArray(parsed.products)) {
      for (const legacy of parsed.products) {
        const id = uid();
        state.products.byId[id] = defaultProduct();
        Object.assign(state.products.byId[id].product, {
          program: legacy.program ?? "",
          ram: legacy.ram ?? "",
          rom: legacy.rom ?? "",
          type: legacy.type ?? "",
          tmcUsd: round2(legacy.tmcUsd ?? 0),
          xRate:  round2(legacy.xRate ?? 0),
          tmcEur: round2((legacy.tmcUsd ?? 0) * (legacy.xRate ?? 0)),
          copyLevy: round2(legacy.copyLevy ?? 0),
          deee: round2(legacy.deee ?? 0)
        });
        state.products.allIds.push(id);
      }
      state.customer = {
        name: parsed.customer?.name ?? "",
        frontEnd: clampPercent2(parsed.customer?.frontEnd ?? 0),
        backEnd: clampPercent2(parsed.customer?.backEnd ?? 0),
        distributorFee: clampPercent2(parsed.customer?.distributorFee ?? 0)
      };
    } else if (parsed.products?.byId && parsed.products?.allIds) {
      Object.assign(state.customer, {
        name: parsed.customer?.name ?? "",
        frontEnd: clampPercent2(parsed.customer?.frontEnd ?? 0),
        backEnd: clampPercent2(parsed.customer?.backEnd ?? 0),
        distributorFee: clampPercent2(parsed.customer?.distributorFee ?? 0)
      });
      state.products = parsed.products;

      for (const id of state.products.allIds) {
        const b = state.products.byId[id];
        if (!b.promotions) b.promotions = defaultProduct().promotions;
        if (typeof b.promotions.promo1SoaManual !== "boolean") b.promotions.promo1SoaManual = false;
        if (typeof b.promotions.promo2SoaManual !== "boolean") b.promotions.promo2SoaManual = false;
        if (typeof b.promotions.soaPerBox !== "number") b.promotions.soaPerBox = 0;
        if (typeof b.pricing.tripleNet !== "number") b.pricing.tripleNet = 0;
        if (typeof b.pricing.aurUsd    !== "number") b.pricing.aurUsd    = 0;
        if (typeof b.pricing.gpPct     !== "number") b.pricing.gpPct     = 0;
      }
    }

    for (const id of state.products.allIds) {
      recomputePricing(id);
      recomputePromotions(id);
      recomputeAurAndGp(id);
    }
    save();
  } catch (e) {
    console.warn("Failed to load store:", e);
  }
}

export function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  catch (e) { console.warn("Failed to save store:", e); }
}

/* ----------------- Accessors ----------------- */
export function getState() { return state; }
export function getCustomer() { return state.customer; }
export function getProductIds() { return state.products.allIds; }
export function getBundle(id) { return state.products.byId[id]; }

/* ----------------- Customer updates ----------------- */
export function updateCustomer(patch) {
  if ("frontEnd" in patch) patch.frontEnd = clampPercent2(patch.frontEnd);
  if ("backEnd" in patch) patch.backEnd = clampPercent2(patch.backEnd);
  if ("distributorFee" in patch) patch.distributorFee = clampPercent2(patch.distributorFee);
  Object.assign(state.customer, patch);

  for (const id of state.products.allIds) {
    recomputePricing(id);
    recomputePromotions(id);
    recomputeAurAndGp(id);
    emit("product:changed", { productId: id, section: "pricing", patch: {} });
    emit("product:changed", { productId: id, section: "promotions", patch: {} });
  }

  save();
  emit("customer:changed", { patch: { ...patch } });
}

export function clearDraft() {
  try { localStorage.removeItem(LS_KEY); } catch {}
  // reset in-memory state
  state.customer = { name: "", frontEnd: 0, backEnd: 0, distributorFee: 0 };
  state.products = { byId: {}, allIds: [] };
}

/* ----------------- Product CRUD ----------------- */
export function createProduct() {
  const id = uid();
  state.products.byId[id] = defaultProduct();
  state.products.allIds.push(id);
  recomputePricing(id);
  recomputePromotions(id);
  recomputeAurAndGp(id);
  save();
  emit("product:created", { productId: id });
  return id;
}

export function deleteProduct(id) {
  if (!(id in state.products.byId)) return;
  delete state.products.byId[id];
  state.products.allIds = state.products.allIds.filter(x => x !== id);
  save();
  emit("product:deleted", { productId: id });
}

/* ----------------- Section updates ----------------- */
export function updateProductSection(id, section, patch) {
  const b = state.products.byId[id];
  if (!b || !b[section]) return;

  const norm = { ...patch };
  for (const k of Object.keys(norm)) {
    const val = norm[k];
    if (typeof val === "number") {
      if (section === "pricing" && k === "vatPct")       norm[k] = clampPercent2(val);
      else if (section === "financials" && k === "gpPct")norm[k] = clampPercent2(val);
      else if (section === "promotions" && /Units$/.test(k)) {
        norm[k] = Math.max(0, Math.trunc(val || 0));
      } else {
        norm[k] = round2(val);
      }
    }
  }

  if (section === "promotions") {
    if ("mode" in norm) {
      const v = String(norm.mode || "").toLowerCase();
      norm.mode = (v === "on_vat_fe") ? "on_vat_fe" : "on_vat";
      norm.promo1SoaManual = false;
      norm.promo2SoaManual = false;
    }
    // manual override al escribir en SOA
    if ("promo1Soa" in norm && !("promo1SoaManual" in norm)) norm.promo1SoaManual = true;
    if ("promo2Soa" in norm && !("promo2SoaManual" in norm)) norm.promo2SoaManual = true;
  }

  Object.assign(b[section], norm);

  if (section === "product" && ("tmcUsd" in norm || "xRate" in norm)) {
    b.product.tmcEur = round2((Number(b.product.tmcUsd) || 0) * (Number(b.product.xRate) || 0));
  }
  if (section === "pricing" && ("rrp" in norm || "vatPct" in norm)) {
    recomputePricing(id);
  }

  if (section === "pricing" || section === "promotions" || section === "customer") {
    recomputePromotions(id);     // <-- actualiza tripleNet con SOA per Box
  }

  if (
    section === "promotions" ||
    section === "pricing" ||
    (section === "product" && ("tmcUsd" in norm || "xRate" in norm || "copyLevy" in norm || "deee" in norm))
  ) {
    recomputeAurAndGp(id);       // <-- depende de tripleNet/xRate/etc
  }

  save();

  // Notificamos SIEMPRE el evento original…
  emit("product:changed", { productId: id, section, patch: { ...norm } });

  // …y, cuando promos/pricing cambian, notificamos además a 'pricing' para refresco inmediato de la tarjeta
  if (section === "promotions" || section === "pricing" || section === "customer") {
    emit("product:changed", {
      productId: id,
      section: "pricing",
      patch: {
        tripleNet: b.pricing.tripleNet,
        aurUsd: b.pricing.aurUsd,
        gpPct: b.pricing.gpPct,
        customerInvoice: b.pricing.customerInvoice,
        distributorInvoice: b.pricing.distributorInvoice,
        rrpNoVat: b.pricing.rrpNoVat
      }
    });
  }
}


/* ----------------- Derived logic ----------------- */
function recomputePricing(id) {
  const b = state.products.byId[id];
  if (!b) return;

  b.product.tmcEur = round2((Number(b.product.tmcUsd) || 0) * (Number(b.product.xRate) || 0));

  const rrp = Number(b.pricing.rrp) || 0;
  const vat = Number(b.pricing.vatPct) || 0;
  const divisor = 1 + (Math.max(0, vat) / 100);
  b.pricing.rrpNoVat = divisor > 0 ? round2(rrp / divisor) : 0;

  const fe = (Number(state.customer.frontEnd) || 0) / 100;
  const df = (Number(state.customer.distributorFee) || 0) / 100;

  const copyLevy = Number(b.product.copyLevy) || 0;
  const deee     = Number(b.product.deee) || 0;

  const baseNoVat = b.pricing.rrpNoVat;
  const customerInvoice = (baseNoVat - copyLevy - deee) * (1 - fe);
  b.pricing.customerInvoice    = round2(Math.max(customerInvoice, 0));
  b.pricing.distributorInvoice = round2(Math.max(b.pricing.customerInvoice * (1 - df), 0));
}

function recomputePromotions(id) {
  const b = state.products.byId[id];
  if (!b) return;

  const rrp   = Number(b.pricing.rrp) || 0;
  const vat   = Number(b.pricing.vatPct) || 0;
  const fePct = Number(state.customer.frontEnd) || 0;

  const disc1Raw = rrp - (Number(b.promotions.promo1Rrp) || 0);
  const disc2Raw = rrp - (Number(b.promotions.promo2Rrp) || 0);
  b.promotions.promo1Discount = round2(Math.max(0, disc1Raw));
  b.promotions.promo2Discount = round2(Math.max(0, disc2Raw));

  const divisor  = 1 + (Math.max(0, vat) / 100);
  const feFactor = 1 - (Math.max(0, fePct) / 100);

  const autoSoa = (disc) => {
    const base = (divisor > 0) ? (disc / divisor) : 0;
    return b.promotions.mode === "on_vat_fe" ? round2(base * feFactor) : round2(base);
  };

  if (!b.promotions.promo1SoaManual) b.promotions.promo1Soa = autoSoa(b.promotions.promo1Discount);
  if (!b.promotions.promo2SoaManual) b.promotions.promo2Soa = autoSoa(b.promotions.promo2Discount);

  const u1 = Math.max(0, Math.trunc(b.promotions.promo1Units || 0));
  const u2 = Math.max(0, Math.trunc(b.promotions.promo2Units || 0));
  b.promotions.promo1Units = u1;
  b.promotions.promo2Units = u2;

  b.promotions.promo1TotalSoa = round2(u1 * (Number(b.promotions.promo1Soa) || 0));
  b.promotions.promo2TotalSoa = round2(u2 * (Number(b.promotions.promo2Soa) || 0));
  b.promotions.totalUnits = u1 + u2;
  b.promotions.totalSoa   = round2(b.promotions.promo1TotalSoa + b.promotions.promo2TotalSoa);
  b.promotions.soaPerBox  = b.promotions.totalUnits > 0
    ? round2(b.promotions.totalSoa / b.promotions.totalUnits)
    : 0;

  const dip = Number(b.pricing.distributorInvoice) || 0;
  const spb = Number(b.promotions.soaPerBox) || 0;
  b.pricing.tripleNet = round2(dip - spb);
}

function recomputeAurAndGp(id) {
  const b = state.products.byId[id];
  if (!b) return;

  const tripleNetEur = Number(b.pricing.tripleNet) || 0; // €/box
  const copyLevy     = Number(b.product.copyLevy) || 0;
  const deee         = Number(b.product.deee) || 0;
  const xRate        = Number(b.product.xRate) || 0;
  const tmcUsd       = Number(b.product.tmcUsd) || 0;

  const aurUsd = (xRate > 0) ? (tripleNetEur + copyLevy + deee) / xRate : 0;
  b.pricing.aurUsd = round2(aurUsd);

  const tripleNetUsd = (xRate > 0) ? (tripleNetEur / xRate) : 0;
  const gpPct = (tmcUsd > 0) ? ((tripleNetUsd / tmcUsd) - 1) * 100 : 0;
  b.pricing.gpPct = round2(gpPct);
}

/* ----------------- GLOBAL SELECTORS (Financials) ----------------- */

// Suma global de unidades en promoción (todos los productos)
export function getTotalPromoUnitsAllProducts() {
  let total = 0;
  for (const id of state.products.allIds) {
    const b = state.products.byId[id];
    if (!b || !b.promotions) continue;
    const u1 = Math.max(0, Math.trunc(b.promotions.promo1Units || 0));
    const u2 = Math.max(0, Math.trunc(b.promotions.promo2Units || 0));
    total += u1 + u2;
  }
  return total;
}

// Totales globales de Net Revenue en € y $
export function getGlobalNetRevenueTotals() {
  let eur = 0;
  let usd = 0;
  for (const id of state.products.allIds) {
    const b = state.products.byId[id];
    if (!b) continue;
    const units = Math.max(0, Math.trunc(b.promotions?.promo1Units || 0)) +
                  Math.max(0, Math.trunc(b.promotions?.promo2Units || 0));
    const aurUsd = Number(b.pricing?.aurUsd) || 0; // AUR ($) por producto
    const xRate  = Number(b.product?.xRate)  || 0; // tipo de cambio del producto
    usd += units * aurUsd;          // Σ (units_i * AUR$_i)
    eur += units * aurUsd * xRate;  // Σ (units_i * AUR$_i * XR_i)
  }
  return { eur: round2(eur), usd: round2(usd), qty: getTotalPromoUnitsAllProducts() };
}

// Totales globales de GP en € y $
export function getGlobalGrossProfitTotals() {
  let gpEur = 0;
  let gpUsd = 0;
  for (const id of state.products.allIds) {
    const b = state.products.byId[id];
    if (!b) continue;

    const units  = Math.max(0, Math.trunc(b.promotions?.promo1Units || 0)) +
                   Math.max(0, Math.trunc(b.promotions?.promo2Units || 0));
    const aurUsd = Number(b.pricing?.aurUsd) || 0;   // AUR ($) por caja
    const xRate  = Number(b.product?.xRate)  || 0;   // €/$
    const tmcUsd = Number(b.product?.tmcUsd) || 0;   // TMC ($) por caja
    const tmcEur = Number(b.product?.tmcEur) || 0;   // TMC (€) por caja

    // GP por caja
    const gpPerBoxUsd = aurUsd - tmcUsd;
    const gpPerBoxEur = (aurUsd * xRate) - tmcEur;

    gpUsd += units * gpPerBoxUsd;
    gpEur += units * gpPerBoxEur;
  }
  return { eur: round2(gpEur), usd: round2(gpUsd) };
}
