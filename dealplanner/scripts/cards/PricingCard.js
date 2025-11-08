/* PricingCard.js
   Per-product pricing block (RRP, VAT, derived w/o VAT, invoice prices).
*/

import { createEl, bindNumberInput, toFixed2 } from "../utils.js";
import { getBundle, updateProductSection } from "../store.js";

export default function renderPricingCard(container, productId) {
  // ---- Card shell ----
  const card  = createEl("section", { className: "card" });
  const title = createEl("h2", { text: "Pricing" });
  const help  = createEl("p", { className: "dp-sub", text: "RRP w/o VAT is computed from RRP and VAT%." });
  const grid  = createEl("div", { className: "dp-grid" });

  const model = getBundle(productId).pricing;

  // ---- RRP (€) ----
  const fRRP = createEl("div", { className: "dp-field" });
  const lblRRP = createEl("label", { text: "RRP (€)" });
  const inpRRP = createEl("input");
  bindNumberInput(inpRRP, () => model.rrp, v => {
    updateProductSection(productId, "pricing", { rrp: v });
    // reflect recomputed no-VAT
    inpNoVAT.value = toFixed2(getBundle(productId).pricing.rrpNoVat);
  });
  fRRP.append(lblRRP, inpRRP);

  // ---- VAT (%) ----
  const fVAT = createEl("div", { className: "dp-field" });
  const lblVAT = createEl("label", { text: "VAT (%)" });
  const inpVAT = createEl("input");
  bindNumberInput(inpVAT, () => model.vatPct, v => {
    updateProductSection(productId, "pricing", { vatPct: v });
    inpNoVAT.value = toFixed2(getBundle(productId).pricing.rrpNoVat);
  }, { percent: true });
  fVAT.append(lblVAT, inpVAT);

  // ---- RRP w/o VAT (€) (readonly) ----
  const fNoVAT = createEl("div", { className: "dp-field" });
  const lblNoVAT = createEl("label", { text: "RRP w/o VAT (€)" });
  const inpNoVAT = createEl("input", { attrs: { readonly: "readonly" } });
  inpNoVAT.value = toFixed2(model.rrpNoVat);
  fNoVAT.append(lblNoVAT, inpNoVAT);

  // ---- Customer Invoice Price (€) ----
  const fCIP = createEl("div", { className: "dp-field" });
  const lblCIP = createEl("label", { text: "Customer Invoice Price (€)" });
  const inpCIP = createEl("input");
  bindNumberInput(inpCIP, () => model.customerInvoice, v => {
    updateProductSection(productId, "pricing", { customerInvoice: v });
  });
  fCIP.append(lblCIP, inpCIP);

  // ---- Retail Invoice Price (€) ----
  const fRIP = createEl("div", { className: "dp-field" });
  const lblRIP = createEl("label", { text: "Retail Invoice Price (€)" });
  const inpRIP = createEl("input");
  bindNumberInput(inpRIP, () => model.retailInvoice, v => {
    updateProductSection(productId, "pricing", { retailInvoice: v });
  });
  fRIP.append(lblRIP, inpRIP);

  // Mount
  grid.append(fRRP, fVAT, fNoVAT, fCIP, fRIP);
  card.append(title, help, grid);
  container.append(card);
}
