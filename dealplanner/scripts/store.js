/* store.js
   Single source of truth + persistence + computed fields.
   Shape:
   {
     customer: { name, frontEnd, backEnd, distributorFee },
     products: {
       byId: {
         [id]: {
           product: {...}, pricing: {...}, financials: {...}
         }
       },
       allIds: []
     }
   }
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
    customerInvoice: 0, retailInvoice: 0
  },
  financials: {
    quantity: 0, grossRevenue: 0, netRevenue: 0, aur: 0, gpPct: 0
  }
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

    // Migration from legacy shapes (array of products or flat pricing/financials)
    if (parsed.products && Array.isArray(parsed.products)) {
      // Legacy array -> convert to byId
      for (const legacy of parsed.products) {
        const id = uid();
        state.products.byId[id] = defaultProduct();
        // Best-effort mapping (legacy fields product.*)
        Object.assign(state.products.byId[id].product, {
          program: legacy.program ?? "",
          ram: legacy.ram ?? "",
          rom: legacy.rom ?? "",
          type: legacy.type ?? "",
          tmcUsd: round2(legacy.tmcUsd ?? 0),
          xRate: round2(legacy.xRate ?? 0),
          tmcEur: round2((legacy.tmcUsd ?? 0) * (legacy.xRate ?? 0)),
          copyLevy: round2(legacy.copyLevy ?? 0),
          deee: round2(legacy.deee ?? 0)
        });
        state.products.allIds.push(id);
      }
      // Customer / pricing / financials global ignored in migration (now per product).
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
    }
  } catch (e) {
    console.warn("Failed to load store:", e);
  }
}

export function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save store:", e);
  }
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
  save();
  emit("customer:changed", { patch: { ...patch } });
}

/* ----------------- Product CRUD ----------------- */
export function createProduct() {
  const id = uid();
  state.products.byId[id] = defaultProduct();
  state.products.allIds.push(id);
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

/* ----------------- Product updates (sections) ----------------- */
export function updateProductSection(id, section, patch) {
  const bundle = state.products.byId[id];
  if (!bundle || !bundle[section]) return;

  // Normalize decimals and percents
  const norm = { ...patch };
  for (const k of Object.keys(norm)) {
    if (typeof norm[k] === "number") {
      if (section === "pricing" && k === "vatPct") norm[k] = clampPercent2(norm[k]);
      else norm[k] = round2(norm[k]);
    }
  }

  Object.assign(bundle[section], norm);

  // Computed fields
  if (section === "product" && ("tmcUsd" in norm || "xRate" in norm)) {
    bundle.product.tmcEur = round2((Number(bundle.product.tmcUsd) || 0) * (Number(bundle.product.xRate) || 0));
  }
  if (section === "pricing" && ("rrp" in norm || "vatPct" in norm)) {
    const rrp = Number(bundle.pricing.rrp) || 0;
    const vat = Number(bundle.pricing.vatPct) || 0;
    const divisor = 1 + (Math.max(0, vat) / 100);
    bundle.pricing.rrpNoVat = divisor > 0 ? round2(rrp / divisor) : 0;
  }
  if (section === "financials" && ("quantity" in norm || "netRevenue" in norm)) {
    const qty = Number(bundle.financials.quantity) || 0;
    const net = Number(bundle.financials.netRevenue) || 0;
    bundle.financials.aur = qty > 0 ? round2(net / qty) : 0;
  }

  save();
  emit("product:changed", { productId: id, section, patch: { ...norm } });
}
