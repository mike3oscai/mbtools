/* PricingCard.js
   Muestra pricing derivado por producto: RRP, VAT, RRP w/o VAT, Customer Invoice, Distributor Invoice,
   Triple Net (€), AUR ($) y GP (%). Refresca cuando cambian promociones (SOA/Unidades), pricing,
   producto (xRate, cánones) o términos de cliente.
*/
import { createEl, toFixed2 } from "../utils.js";
import { getBundle, updateProductSection } from "../store.js";
import { on } from "../bus.js";

export default function PricingCard(root, productId) {
  const b = getBundle(productId);
  if (!b) return;

  const card  = createEl("section", { className: "card" });
  const title = createEl("h2", { text: "Pricing" });
  const help  = createEl("p",  { className: "dp-sub", text: "RRP is edited in Product. All values update from Product, Promotions and Customer terms." });

  const grid  = createEl("div", { className: "dp-grid" });

  // RRP (€) (readonly aquí; editable en Product)
  const fRrp   = createEl("div", { className: "dp-field" });
  const lblRrp = createEl("label", { text: "RRP (€)" });
  const inpRrp = createEl("input", { attrs: { readonly: "readonly" } });
  fRrp.append(lblRrp, inpRrp);

  // VAT (%)
  const fVat   = createEl("div", { className: "dp-field" });
  const lblVat = createEl("label", { text: "VAT (%)" });
  const inpVat = createEl("input", { attrs: { type: "number", step: "0.01", min: "0" } });
  fVat.append(lblVat, inpVat);

  // RRP sin IVA (readonly)
  const fNoVat   = createEl("div", { className: "dp-field" });
  const lblNoVat = createEl("label", { text: "RRP w/o VAT (€)" });
  const inpNoVat = createEl("input", { attrs: { readonly: "readonly" } });
  fNoVat.append(lblNoVat, inpNoVat);

  // Customer Invoice (€)
  const fCI   = createEl("div", { className: "dp-field" });
  const lblCI = createEl("label", { text: "Customer Invoice Price (€)" });
  const inpCI = createEl("input", { attrs: { readonly: "readonly" } });
  fCI.append(lblCI, inpCI);

  // Distributor Invoice (€)
  const fDI   = createEl("div", { className: "dp-field" });
  const lblDI = createEl("label", { text: "Distributor Invoice Price (€)" });
  const inpDI = createEl("input", { attrs: { readonly: "readonly" } });
  fDI.append(lblDI, inpDI);

  // Triple Net (€)
  const fTN   = createEl("div", { className: "dp-field" });
  const lblTN = createEl("label", { text: "Triple Net (€)" });
  const inpTN = createEl("input", { attrs: { readonly: "readonly" } });
  fTN.append(lblTN, inpTN);

  // AUR ($)
  const fAUR   = createEl("div", { className: "dp-field" });
  const lblAUR = createEl("label", { text: "AUR ($)" });
  const inpAUR = createEl("input", { attrs: { readonly: "readonly" } });
  fAUR.append(lblAUR, inpAUR);

  // GP (%)
  const fGP   = createEl("div", { className: "dp-field" });
  const lblGP = createEl("label", { text: "GP (%)" });
  const inpGP = createEl("input", { attrs: { readonly: "readonly" } });
  fGP.append(lblGP, inpGP);

  grid.append(fRrp, fVat, fNoVat, fCI, fDI, fTN, fAUR, fGP);
  card.append(title, help, grid);
  root.append(card);

  // Eventos
  inpVat.addEventListener("input", () => {
    const vat = parseFloat(inpVat.value) || 0;
    updateProductSection(productId, "pricing", { vatPct: vat });
  });

  function refresh() {
    const s = getBundle(productId);
    if (!s) return;

    inpRrp.value  = toFixed2(s.pricing.rrp || 0);
    inpVat.value  = (s.pricing.vatPct ?? 0);
    inpNoVat.value= toFixed2(s.pricing.rrpNoVat || 0);

    inpCI.value   = toFixed2(s.pricing.customerInvoice || 0);
    inpDI.value   = toFixed2(s.pricing.distributorInvoice || 0);

    // 🔄 Ahora refleja cambios de promos (SOA per Box → Triple Net) inmediatamente
    inpTN.value   = toFixed2(s.pricing.tripleNet || 0);

    inpAUR.value  = toFixed2(s.pricing.aurUsd || 0);
    inpGP.value   = toFixed2(s.pricing.gpPct || 0);
  }

  // Escuchamos cambios de pricing, promotions, product y customer
  const off = on("product:changed", ({ productId: id, section }) => {
    if (id !== productId) return;
    if (["pricing", "promotions", "product", "customer"].includes(section)) refresh();
  });

  refresh();

  // Limpieza
  card.addEventListener("DOMNodeRemoved", () => off(), { once: true });
}
