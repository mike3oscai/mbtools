/* PromotionsCard.js
   Promotions with mode switch + computed discounts/SOA + totals.
   SOA fields allow manual override (applied on blur); units are integers.
*/

import { createEl, bindNumberInput, toFixed2 } from "../utils.js";
import { getBundle, updateProductSection } from "../store.js";
import { on } from "../bus.js";

export default function renderPromotionsCard(container, productId) {
  const card  = createEl("section", { className: "card" });
  const title = createEl("h2", { text: "Promotions" });
  const help  = createEl("p", { className: "dp-sub", text: "SOA mode: On VAT or On VAT - FE. SOA fields allow manual override (applied on blur)." });
  const grid  = createEl("div", { className: "dp-grid" });

  const b = () => getBundle(productId);
  const m = () => b().promotions;

  // flags para evitar que refresh pise lo que escribe el usuario
  let editingSoa1 = false;
  let editingSoa2 = false;

  // ----- Mode switch -----
  const fMode = createEl("div", { className: "dp-field" });
  const lblMode = createEl("label", { text: "SOA calculation mode" });
  const selMode = createEl("select");
  selMode.append(createEl("option", { attrs: { value: "on_vat" },   text: "On VAT" }));
  selMode.append(createEl("option", { attrs: { value: "on_vat_fe" },text: "On VAT - FE" }));
  selMode.value = m().mode || "on_vat";
  selMode.addEventListener("change", () => updateProductSection(productId, "promotions", { mode: selMode.value }));
  fMode.append(lblMode, selMode);

  // ---------- Promo 1 ----------
  const fRrp1 = createEl("div", { className: "dp-field" });
  const lblRrp1 = createEl("label", { text: "Promo RRP 1 (€)" });
  const inpRrp1 = createEl("input");
  bindNumberInput(inpRrp1, () => m().promo1Rrp, v => {
    updateProductSection(productId, "promotions", { promo1Rrp: v });
    refresh();
  });
  fRrp1.append(lblRrp1, inpRrp1);

  const fDisc1 = createEl("div", { className: "dp-field" });
  const lblDisc1 = createEl("label", { text: "Discount Promo RRP 1 (€)" });
  const inpDisc1 = createEl("input", { attrs: { readonly: "readonly" } });
  fDisc1.append(lblDisc1, inpDisc1);

  const fSoa1 = createEl("div", { className: "dp-field" });
  const lblSoa1 = createEl("label", { text: "SOA Promo RRP 1 (€)" });
  const inpSoa1 = createEl("input", { attrs: { type: "number", step: "0.01", inputmode: "decimal" } });
  inpSoa1.value = toFixed2(m().promo1Soa);
  inpSoa1.addEventListener("focus", () => { editingSoa1 = true; });
  inpSoa1.addEventListener("input", () => { /* no formatear mientras escribe */ });
  inpSoa1.addEventListener("blur", () => {
    editingSoa1 = false;
    const num = Number(inpSoa1.value);
    const val = Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
    updateProductSection(productId, "promotions", { promo1Soa: val, promo1SoaManual: true });
    refresh();
  });
  fSoa1.append(lblSoa1, inpSoa1);

  const fUnits1 = createEl("div", { className: "dp-field" });
  const lblUnits1 = createEl("label", { text: "Units Promo RRP 1" });
  const inpUnits1 = createEl("input", { attrs: { type: "number", step: "1", min: "0", inputmode: "numeric" } });
  inpUnits1.value = String(m().promo1Units ?? 0);
  inpUnits1.addEventListener("input", () => {
    const v = Math.max(0, Math.trunc(Number(inpUnits1.value) || 0));
    updateProductSection(productId, "promotions", { promo1Units: v });
    refreshTotalsOnly();
  });
  fUnits1.append(lblUnits1, inpUnits1);

  const fTotSoa1 = createEl("div", { className: "dp-field" });
  const lblTotSoa1 = createEl("label", { text: "Total SOA Promo RRP 1 (€)" });
  const inpTotSoa1 = createEl("input", { attrs: { readonly: "readonly" } });
  fTotSoa1.append(lblTotSoa1, inpTotSoa1);

  // ---------- Promo 2 ----------
  const fRrp2 = createEl("div", { className: "dp-field" });
  const lblRrp2 = createEl("label", { text: "Promo RRP 2 (€)" });
  const inpRrp2 = createEl("input");
  bindNumberInput(inpRrp2, () => m().promo2Rrp, v => {
    updateProductSection(productId, "promotions", { promo2Rrp: v });
    refresh();
  });
  fRrp2.append(lblRrp2, inpRrp2);

  const fDisc2 = createEl("div", { className: "dp-field" });
  const lblDisc2 = createEl("label", { text: "Discount Promo RRP 2 (€)" });
  const inpDisc2 = createEl("input", { attrs: { readonly: "readonly" } });
  fDisc2.append(lblDisc2, inpDisc2);

  const fSoa2 = createEl("div", { className: "dp-field" });
  const lblSoa2 = createEl("label", { text: "SOA Promo RRP 2 (€)" });
  const inpSoa2 = createEl("input", { attrs: { type: "number", step: "0.01", inputmode: "decimal" } });
  inpSoa2.value = toFixed2(m().promo2Soa);
  inpSoa2.addEventListener("focus", () => { editingSoa2 = true; });
  inpSoa2.addEventListener("input", () => { /* sin formatear mientras escribe */ });
  inpSoa2.addEventListener("blur", () => {
    editingSoa2 = false;
    const num = Number(inpSoa2.value);
    const val = Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
    updateProductSection(productId, "promotions", { promo2Soa: val, promo2SoaManual: true });
    refresh();
  });
  fSoa2.append(lblSoa2, inpSoa2);

  const fUnits2 = createEl("div", { className: "dp-field" });
  const lblUnits2 = createEl("label", { text: "Units Promo RRP 2" });
  const inpUnits2 = createEl("input", { attrs: { type: "number", step: "1", min: "0", inputmode: "numeric" } });
  inpUnits2.value = String(m().promo2Units ?? 0);
  inpUnits2.addEventListener("input", () => {
    const v = Math.max(0, Math.trunc(Number(inpUnits2.value) || 0));
    updateProductSection(productId, "promotions", { promo2Units: v });
    refreshTotalsOnly();
  });
  fUnits2.append(lblUnits2, inpUnits2);

  const fTotSoa2 = createEl("div", { className: "dp-field" });
  const lblTotSoa2 = createEl("label", { text: "Total SOA Promo RRP 2 (€)" });
  const inpTotSoa2 = createEl("input", { attrs: { readonly: "readonly" } });
  fTotSoa2.append(lblTotSoa2, inpTotSoa2);

  // ---------- Totales ----------
  const fTotUnits = createEl("div", { className: "dp-field" });
  const lblTotUnits = createEl("label", { text: "Total Units on Promotion" });
  const inpTotUnits = createEl("input", { attrs: { readonly: "readonly" } });
  fTotUnits.append(lblTotUnits, inpTotUnits);

  const fTotSoa = createEl("div", { className: "dp-field" });
  const lblTotSoa = createEl("label", { text: "Total SOA to accrue (€)" });
  const inpTotSoa = createEl("input", { attrs: { readonly: "readonly" } });
  fTotSoa.append(lblTotSoa, inpTotSoa);

  // ---------- SOA per Box ----------
  const fSoaPerBox = createEl("div", { className: "dp-field" });
  const lblSoaPerBox = createEl("label", { text: "SOA per Box (€)" });
  const inpSoaPerBox = createEl("input", { attrs: { readonly: "readonly" } });
  fSoaPerBox.append(lblSoaPerBox, inpSoaPerBox);

  grid.append(
    fMode,
    fRrp1, fDisc1, fSoa1, fUnits1, fTotSoa1,
    fRrp2, fDisc2, fSoa2, fUnits2, fTotSoa2,
    fTotUnits, fTotSoa,
    fSoaPerBox
  );

  card.append(title, help, grid);
  container.append(card);

  // ---- Live refresh when dependencies change ----
  const off1 = on("product:changed", ({ productId: id, section }) => {
    if (id !== productId) return;
    if (section === "pricing" || section === "promotions") refresh();
  });
  const off2 = on("customer:changed", () => refresh());

  function refresh() {
    const P = m();
    // Descuentos
    inpDisc1.value   = toFixed2(P.promo1Discount);
    inpDisc2.value   = toFixed2(P.promo2Discount);

    // SOA (no pisar si el usuario edita)
    if (!editingSoa1) inpSoa1.value = toFixed2(P.promo1Soa);
    if (!editingSoa2) inpSoa2.value = toFixed2(P.promo2Soa);

    // Units normalizados
    inpUnits1.value  = String(P.promo1Units ?? 0);
    inpUnits2.value  = String(P.promo2Units ?? 0);

    // Totales
    refreshTotalsOnly();
  }

  function refreshTotalsOnly() {
    const P = m();
    inpTotSoa1.value   = toFixed2(P.promo1TotalSoa);
    inpTotSoa2.value   = toFixed2(P.promo2TotalSoa);
    inpTotUnits.value  = String(P.totalUnits ?? 0);
    inpTotSoa.value    = toFixed2(P.totalSoa);
    inpSoaPerBox.value = toFixed2(P.soaPerBox);
  }

  // primera pintura
  refresh();

  // Cleanup (opcional)
  card.addEventListener("DOMNodeRemoved", () => { off1(); off2(); }, { once: true });
}
