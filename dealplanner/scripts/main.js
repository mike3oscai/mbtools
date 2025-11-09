/* main.js
   App bootstrap & composition: mounts Customer card, per-product bundles, global Financials, and export.
*/

import { load as loadStore, getProductIds, createProduct, clearDraft } from "./store.js";
import { createEl } from "./utils.js";
import { on } from "./bus.js";
import renderCustomerCard from "./cards/CustomerCard.js";
import mountProductBundle from "./cards/ProductBundle.js";
import renderFinancialsCardGlobal from "./cards/FinancialsCard.js";
import { loadCatalog, loadCustomers } from "./dataService.js";
import { exportToXlsx } from "./exportExcel.js";

function ensureRoot() {
  let main = document.querySelector("main.container");
  if (!main) {
    main = createEl("main", { className: "container" });
    document.body.appendChild(main);
  }
  let root = document.querySelector("#dealplanner-root");
  if (!root) {
    root = createEl("div", { attrs: { id: "dealplanner-root" } });
    main.append(root);
  }
  return root;
}

function mountHeader(root) {
  const header = createEl("div", { className: "action-card" });
  const h1 = createEl("h1", { text: "Deal Planner" });
  const p = createEl("p", { text: "Crea y evalúa la rentabilidad de tus deals con datos del catálogo." });
  header.append(h1, p);
  root.append(header);
}

function ensureBundlesContainer(root) {
  let wrap = document.querySelector("#product-bundles");
  if (!wrap) {
    wrap = createEl("div", { attrs: { id: "product-bundles" } });
    root.append(wrap);
  }
  return wrap;
}

/** Barra de acciones debajo de Customer */
function mountActionsBelowCustomer(root) {
  const actions = createEl("div", { style: "margin:.5rem 0 1rem; display:flex; gap:.5rem; flex-wrap:wrap;" });

  const btnAdd = createEl("button", { className: "btn", text: "Add Product" });
  btnAdd.type = "button";
  btnAdd.addEventListener("click", () => createProduct());

  const btnClear = createEl("button", { className: "btn btn-ghost", text: "Clear Simulation" });
  btnClear.type = "button";
  btnClear.addEventListener("click", () => {
    clearDraft();
    window.location.reload();
  });

  actions.append(btnAdd, btnClear);
  root.append(actions);
}

document.addEventListener("DOMContentLoaded", async () => {
  loadStore();
  await Promise.all([loadCatalog(), loadCustomers()]);

  const root = ensureRoot();
  mountHeader(root);

  // Customer
  renderCustomerCard(root);
  mountActionsBelowCustomer(root);

  // Existing bundles
  const bundlesWrap = ensureBundlesContainer(root);
  for (const id of getProductIds()) {
    mountProductBundle(bundlesWrap, id);
  }

  // New bundles
  on("product:created", ({ productId }) => {
    mountProductBundle(bundlesWrap, productId);
  });

  // Financials (global)
  renderFinancialsCardGlobal(root);

  // Export to Excel (al final)
  const footerActions = createEl("div", { style: "margin:1rem 0 2rem; display:flex; gap:.5rem; flex-wrap:wrap;" });
const btnExport = createEl("button", { className: "btn", text: "Export to Excel" });
btnExport.type = "button";
btnExport.addEventListener("click", exportToXlsx);
footerActions.append(btnExport);
root.append(footerActions);
});
