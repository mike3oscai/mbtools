/* FinancialsCard.js (GLOBAL)
   Shows:
   - Quantity = Σ (Units Promo RRP 1 + Units Promo RRP 2) across all products
   - Total Net Revenue (€) = Σ units × (AUR($) × X-Rate)
   - Total Net Revenue ($) = Σ units × AUR($)
   - Total GP (€) = Σ units × ((AUR($) × X-Rate) − TMC(€))
   - Total GP ($) = Σ units × (AUR($) − TMC($))
   - Total GP (%) = Cost-basis aggregate: (Σ units×TripleNet($) / Σ units×TMC($)) − 1
*/

import { createEl, toFixed2 } from "../utils.js";
import {
  getTotalPromoUnitsAllProducts,
  getGlobalNetRevenueTotals,
  getGlobalGrossProfitTotals,
  getState
} from "../store.js";
import { on } from "../bus.js";

export default function renderFinancialsCardGlobal(root) {
  const card  = createEl("section", { className: "card" });
  const title = createEl("h2", { text: "Financials" });
  const help  = createEl("p",  { className: "dp-sub", text: "Global totals computed across all products on promotion." });

  const grid  = createEl("div", { className: "dp-grid" });

  // Quantity (readonly)
  const fQty   = createEl("div", { className: "dp-field" });
  const lblQty = createEl("label", { text: "Quantity" });
  const inpQty = createEl("input", { attrs: { readonly: "readonly" } });
  fQty.append(lblQty, inpQty);

  // Total Net Revenue (€)
  const fTotEur   = createEl("div", { className: "dp-field" });
  const lblTotEur = createEl("label", { text: "Total Net Revenue (€)" });
  const inpTotEur = createEl("input", { attrs: { readonly: "readonly" } });
  fTotEur.append(lblTotEur, inpTotEur);

  // Total Net Revenue ($)
  const fTotUsd   = createEl("div", { className: "dp-field" });
  const lblTotUsd = createEl("label", { text: "Total Net Revenue ($)" });
  const inpTotUsd = createEl("input", { attrs: { readonly: "readonly" } });
  fTotUsd.append(lblTotUsd, inpTotUsd);

  // Total GP (€)
  const fGpEur   = createEl("div", { className: "dp-field" });
  const lblGpEur = createEl("label", { text: "Total GP (€)" });
  const inpGpEur = createEl("input", { attrs: { readonly: "readonly" } });
  fGpEur.append(lblGpEur, inpGpEur);

  // Total GP ($)
  const fGpUsd   = createEl("div", { className: "dp-field" });
  const lblGpUsd = createEl("label", { text: "Total GP ($)" });
  const inpGpUsd = createEl("input", { attrs: { readonly: "readonly" } });
  fGpUsd.append(lblGpUsd, inpGpUsd);

  // Total GP (%)
  const fGpPct   = createEl("div", { className: "dp-field" });
  const lblGpPct = createEl("label", { text: "Total GP (%)" });
  const inpGpPct = createEl("input", { attrs: { readonly: "readonly" } });
  fGpPct.append(lblGpPct, inpGpPct);

  grid.append(fQty, fTotEur, fTotUsd, fGpEur, fGpUsd, fGpPct);
  card.append(title, help, grid);
  root.append(card);

  // ---- Cost-basis aggregate helper (consistent with per-product GP% definition) ----
  function sumForCostBasis() {
    const { products } = getState();
    let tripleNetSumUsd = 0; // Σ units × Triple Net ($) per product
    let tmcSumUsd       = 0; // Σ units × TMC ($) per product

    for (const id of products.allIds) {
      const b = products.byId[id];
      if (!b) continue;

      const units =
        Math.max(0, Math.trunc(b.promotions?.promo1Units || 0)) +
        Math.max(0, Math.trunc(b.promotions?.promo2Units || 0));

      const tripleNetEur = Number(b.pricing?.tripleNet) || 0; // €/box
      const xRate        = Number(b.product?.xRate)     || 0; // €/$
      const tripleNetUsd = xRate > 0 ? (tripleNetEur / xRate) : 0;

      const tmcUsd       = Number(b.product?.tmcUsd)    || 0; // $/box

      tripleNetSumUsd += units * tripleNetUsd;
      tmcSumUsd       += units * tmcUsd;
    }
    return { tripleNetSumUsd, tmcSumUsd };
  }

  function refresh() {
    const qty    = getTotalPromoUnitsAllProducts();
    const totals = getGlobalNetRevenueTotals();   // Net revenue totals (€, $)
    const gp     = getGlobalGrossProfitTotals();  // GP totals (€, $)

    // Cost-basis Total GP % = (Σ units×TripleNet$ / Σ units×TMC$) − 1
    const { tripleNetSumUsd, tmcSumUsd } = sumForCostBasis();
    const totalGpPct = (tmcSumUsd > 0) ? ((tripleNetSumUsd / tmcSumUsd) - 1) * 100 : 0;

    inpQty.value    = String(qty);
    inpTotEur.value = toFixed2(totals.eur || 0);
    inpTotUsd.value = toFixed2(totals.usd || 0);
    inpGpEur.value  = toFixed2(gp.eur || 0);
    inpGpUsd.value  = toFixed2(gp.usd || 0);
    inpGpPct.value  = toFixed2(totalGpPct);
  }

  // Listen for changes that can affect totals
  const off1 = on("product:changed", ({ section }) => {
    if (["promotions", "product", "pricing", "customer"].includes(section)) refresh();
  });
  const off2 = on("product:created", refresh);
  const off3 = on("product:deleted", refresh);

  refresh();

  card.addEventListener("DOMNodeRemoved", () => { off1(); off2(); off3(); }, { once: true });
}
