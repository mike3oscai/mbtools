/* CustomerCard.js
   Tarjeta para seleccionar cliente y definir Front End, Back End y Distributor Fee.
*/

import { createEl } from "../utils.js";
import { updateCustomer, getCustomer } from "../store.js";
import { getCustomers } from "../dataService.js";

export default async function renderCustomerCard(root) {
  const card  = createEl("section", { className: "card" });
  const head  = createEl("h2", { text: "Customer" });
  const help  = createEl("p", { className: "dp-sub", text: "Selecciona el cliente y define Front/Back End y Distributor Fee." });

  const grid  = createEl("div", { className: "dp-grid" });

  // Campos
  const fName = createEl("div", { className: "dp-field" });
  const lblName = createEl("label", { text: "Customer Name" });
  const inpName = createEl("input", { attrs: { list: "customerList" } });
  fName.append(lblName, inpName);

  const fFE = createEl("div", { className: "dp-field" });
  const lblFE = createEl("label", { text: "Front End (%)" });
  const inpFE = createEl("input", { attrs: { type: "number", step: "0.01", min: "0" } }); // ✅ admite decimales
  fFE.append(lblFE, inpFE);

  const fBE = createEl("div", { className: "dp-field" });
  const lblBE = createEl("label", { text: "Back End (%)" });
  const inpBE = createEl("input", { attrs: { type: "number", step: "0.01", min: "0" } }); // ✅ admite decimales
  fBE.append(lblBE, inpBE);

  const fDF = createEl("div", { className: "dp-field" });
  const lblDF = createEl("label", { text: "Distributor Fee (%)" });
  const inpDF = createEl("input", { attrs: { type: "number", step: "0.01", min: "0" } }); // ✅ admite decimales
  fDF.append(lblDF, inpDF);

  grid.append(fName, fFE, fBE, fDF);
  card.append(head, help, grid);
  root.append(card);

  // Populate customer datalist
  try {
    const customers = await getCustomers();
    const datalist = createEl("datalist", { attrs: { id: "customerList" } });
    for (const c of customers) {
      const opt = createEl("option", { attrs: { value: c.customerName } });
      datalist.append(opt);
    }
    root.append(datalist);
  } catch (err) {
    console.warn("No se pudieron cargar los clientes:", err);
  }

  // Populate con el estado actual
  const state = getCustomer();
  inpName.value = state.name || "";
  inpFE.value   = state.frontEnd || 0;
  inpBE.value   = state.backEnd || 0;
  inpDF.value   = state.distributorFee || 0;

  // Manejadores de eventos
  inpName.addEventListener("change", () => {
    updateCustomer({ name: inpName.value.trim() });
  });

  inpFE.addEventListener("input", () => {
    const val = parseFloat(inpFE.value) || 0;
    updateCustomer({ frontEnd: val });
  });

  inpBE.addEventListener("input", () => {
    const val = parseFloat(inpBE.value) || 0;
    updateCustomer({ backEnd: val });
  });

  inpDF.addEventListener("input", () => {
    const val = parseFloat(inpDF.value) || 0;
    updateCustomer({ distributorFee: val });
  });
}
