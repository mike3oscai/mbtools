/* main.js
   Bootstrap: load datasets + store, mount Customer + list of product bundles, add "Add Product" control.
*/

import { ensureMainContainer, createEl } from "./utils.js";
import { loadDatasets } from "./dataService.js";
import { load as loadStore, getProductIds, createProduct } from "./store.js";
import { on } from "./bus.js";
import renderCustomerCard from "./cards/CustomerCard.js";
import mountProductBundle from "./cards/ProductBundle.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Footer year and theme (optional)
  const y = document.getElementById("y");
  if (y) y.textContent = new Date().getFullYear();

  // Datasets + state
  loadStore();
  await loadDatasets();

  const main = ensureMainContainer();
  let root = document.querySelector("#dealplanner-root");
  if (!root) {
    root = createEl("div", { attrs: { id: "dealplanner-root" } });
    main.append(root);
  }

  // Header
  const header = createEl("div", { className: "action-card" });
  const h1 = createEl("h1", { text: "Deal Planner" });
  const p  = createEl("p", { text: "Build and evaluate deal profitability per product." });
  header.append(h1, p);
  root.append(header);

  // Customer Card (single)
  renderCustomerCard(root);

  // Toolbar for products
  const toolbar = createEl("div", { className: "dp-card-head" });
  const h2 = createEl("h2", { text: "Products" });
  const addBtn = createEl("button", { className: "btn", text: "Add Product" });
  toolbar.append(h2, addBtn);
  root.append(toolbar);

  // Container for product bundles
  const list = createEl("div", { attrs: { id: "dp-bundles" } });
  root.append(list);

  // Mount existing products
  for (const id of getProductIds()) {
    mountProductBundle(list, id);
  }

  // Add product: only create; mounting is handled by the event listener below
  addBtn.addEventListener("click", () => {
    createProduct();
  });

  // React to newly created products
  on("product:created", ({ productId }) => {
    mountProductBundle(list, productId);
  });
});
