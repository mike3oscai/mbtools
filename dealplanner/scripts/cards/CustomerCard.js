/* CustomerCard.js
   Renders customer card (single instance).
*/

import { createEl, uniqueSorted, bindNumberInput } from "../utils.js";
import { getCustomer, updateCustomer } from "../store.js";
import { getCustomers } from "../dataService.js";

export default function renderCustomerCard(root) {
  const card  = createEl("section", { className: "card" });
  const title = createEl("h2", { text: "Customer" });
  const help  = createEl("p", { text: "Select a customer and define Front/Back End and Distributor Fee." });

  const grid = createEl("div", { className: "dp-grid" });
  const customer = getCustomer();

  // Customer Name (datalist from customerset.json -> customerName)
  const fCustomer   = createEl("div", { className: "dp-field" });
  const lblCustomer = createEl("label", { text: "Customer Name" });
  const inpCustomer = createEl("input", { attrs: { type: "text", list: "dlCustomerNames", placeholder: "e.g. Media Markt" } });
  const dl          = createEl("datalist", { attrs: { id: "dlCustomerNames" } });
  const names = uniqueSorted(getCustomers().map(c => c.customerName));
  for (const n of names) dl.append(createEl("option", { attrs: { value: n } }));
  inpCustomer.value = customer.name || "";
  inpCustomer.addEventListener("input", () => updateCustomer({ name: inpCustomer.value.trim() }));
  fCustomer.append(lblCustomer, inpCustomer, dl);

  // Front End %
  const fFE   = createEl("div", { className: "dp-field" });
  const lblFE = createEl("label", { text: "Front End (%)" });
  const inpFE = createEl("input");
  bindNumberInput(inpFE, () => customer.frontEnd, v => updateCustomer({ frontEnd: v }), { percent: true });
  fFE.append(lblFE, inpFE);

  // Back End %
  const fBE   = createEl("div", { className: "dp-field" });
  const lblBE = createEl("label", { text: "Back End (%)" });
  const inpBE = createEl("input");
  bindNumberInput(inpBE, () => customer.backEnd, v => updateCustomer({ backEnd: v }), { percent: true });
  fBE.append(lblBE, inpBE);

  // Distributor Fee %
  const fDF   = createEl("div", { className: "dp-field" });
  const lblDF = createEl("label", { text: "Distributor Fee (%)" });
  const inpDF = createEl("input");
  bindNumberInput(inpDF, () => customer.distributorFee, v => updateCustomer({ distributorFee: v }), { percent: true });
  fDF.append(lblDF, inpDF);

  grid.append(fCustomer, fFE, fBE, fDF);

  const status = createEl("small", { className: "dp-status", text: "Fill the fields…" });
  card.append(title, help, grid, status);
  root.append(card);
}
