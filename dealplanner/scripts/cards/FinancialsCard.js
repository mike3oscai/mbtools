/* FinancialsCard.js
   Per-product financials (qty, gross/net, AUR auto, GP% manual for now).
*/

import { createEl, bindNumberInput, toFixed2 } from "../utils.js";
import { getBundle, updateProductSection } from "../store.js";

export default function renderFinancialsCard(container, productId) {
  const card  = createEl("section", { className: "card" });
  const title = createEl("h2", { text: "Financials" });
  const help  = createEl("p", { className: "dp-sub", text: "AUR is computed as Net Revenue / Quantity." });
  const grid  = createEl("div", { className: "dp-grid" });

  const model = getBundle(productId).financials;

  // Quantity
  const fQty = createEl("div", { className: "dp-field" });
  const lblQty = createEl("label", { text: "Quantity" });
  const inpQty = createEl("input");
  bindNumberInput(inpQty, () => model.quantity, v => {
    updateProductSection(productId, "financials", { quantity: v });
    inpAUR.value = toFixed2(getBundle(productId).financials.aur);
  });
  fQty.append(lblQty, inpQty);

  // Gross Revenue
  const fGross = createEl("div", { className: "dp-field" });
  const lblGross = createEl("label", { text: "Gross Revenue (€)" });
  const inpGross = createEl("input");
  bindNumberInput(inpGross, () => model.grossRevenue, v => updateProductSection(productId, "financials", { grossRevenue: v }));
  fGross.append(lblGross, inpGross);

  // Net Revenue
  const fNet = createEl("div", { className: "dp-field" });
  const lblNet = createEl("label", { text: "Net Revenue (€)" });
  const inpNet = createEl("input");
  bindNumberInput(inpNet, () => model.netRevenue, v => {
    updateProductSection(productId, "financials", { netRevenue: v });
    inpAUR.value = toFixed2(getBundle(productId).financials.aur);
  });
  fNet.append(lblNet, inpNet);

  // AUR (readonly)
  const fAUR = createEl("div", { className: "dp-field" });
  const lblAUR = createEl("label", { text: "AUR (€)" });
  const inpAUR = createEl("input", { attrs: { readonly: "readonly" } });
  inpAUR.value = toFixed2(model.aur);
  fAUR.append(lblAUR, inpAUR);

  // GP % (manual for now)
  const fGP = createEl("div", { className: "dp-field" });
  const lblGP = createEl("label", { text: "GP (%)" });
  const inpGP = createEl("input");
  bindNumberInput(inpGP, () => model.gpPct, v => updateProductSection(productId, "financials", { gpPct: v }), { percent: true });
  fGP.append(lblGP, inpGP);

  grid.append(fQty, fGross, fNet, fAUR, fGP);
  card.append(title, help, grid);
  container.append(card);
}
