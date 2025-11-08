/* ProductCard.js
   Product-level technical & cost inputs (per productId).
*/

import { createEl, uniqueSorted, bindNumberInput, toFixed2 } from "../utils.js";
import { getBundle, updateProductSection, deleteProduct } from "../store.js";
import { getProducts } from "../dataService.js";

export default function renderProductCard(container, productId) {
  const card = createEl("section", { className: "card" });
  const head = createEl("div", { className: "dp-card-head" });
  const title = createEl("h2", { text: "Product" });
  const btnRemove = createEl("button", { className: "btn btn-ghost", text: "Remove bundle" });
  btnRemove.addEventListener("click", () => deleteProduct(productId));
  head.append(title, btnRemove);

  const help = createEl("p", { className: "dp-sub", text: "Select Program/RAM/ROM from catalog and fill amounts. TMC € is calculated automatically." });
  const grid = createEl("div", { className: "dp-grid" });

  const bundle = getBundle(productId);
  const model = bundle.product;

  // Catalog helpers
  const catalog = getProducts();
  const allPrograms = uniqueSorted(catalog.map(p => p.Program));
  const ramFor = (program) => uniqueSorted(catalog.filter(p => p.Program === program).map(p => p.RAM));
  const romFor = (program, ram) => uniqueSorted(catalog.filter(p => p.Program === program && p.RAM === ram).map(p => p.ROM));

  // Program
  const fProgram = createEl("div", { className: "dp-field" });
  const lblProgram = createEl("label", { text: "Program" });
  const selProgram = createEl("select");
  selProgram.append(createEl("option", { attrs: { value: "" }, text: "— Select Program —" }));
  for (const pr of allPrograms) selProgram.append(createEl("option", { attrs: { value: pr }, text: pr }));
  selProgram.value = model.program || "";
  selProgram.addEventListener("change", () => {
    updateProductSection(productId, "product", { program: selProgram.value || "", ram: "", rom: "" });
    populateRAM(); populateROM();
  });
  fProgram.append(lblProgram, selProgram);

  // RAM
  const fRAM = createEl("div", { className: "dp-field" });
  const lblRAM = createEl("label", { text: "RAM" });
  const selRAM = createEl("select");
  selRAM.append(createEl("option", { attrs: { value: "" }, text: "— Select RAM —" }));
  selRAM.addEventListener("change", () => updateProductSection(productId, "product", { ram: selRAM.value || "", rom: "" }));
  fRAM.append(lblRAM, selRAM);

  // ROM
  const fROM = createEl("div", { className: "dp-field" });
  const lblROM = createEl("label", { text: "ROM" });
  const selROM = createEl("select");
  selROM.append(createEl("option", { attrs: { value: "" }, text: "— Select ROM —" }));
  selROM.addEventListener("change", () => updateProductSection(productId, "product", { rom: selROM.value || "" }));
  fROM.append(lblROM, selROM);

  // Type
  const fType = createEl("div", { className: "dp-field" });
  const lblType = createEl("label", { text: "Type" });
  const inpType = createEl("input", { attrs: { type: "text", placeholder: "e.g. Smartphone" } });
  inpType.value = model.type || "";
  inpType.addEventListener("input", () => updateProductSection(productId, "product", { type: inpType.value.trim() }));
  fType.append(lblType, inpType);

  // TMC $
  const fTmcUsd = createEl("div", { className: "dp-field" });
  const lblUsd = createEl("label", { text: "TMC $" });
  const inpUsd = createEl("input");
  bindNumberInput(inpUsd, () => model.tmcUsd, v => updateProductSection(productId, "product", { tmcUsd: v }), {
    onBlur: () => { inpEur.value = toFixed2(getBundle(productId).product.tmcEur); }
  });
  fTmcUsd.append(lblUsd, inpUsd);

  // X-Rate
  const fXRate = createEl("div", { className: "dp-field" });
  const lblXr = createEl("label", { text: "X-Rate" });
  const inpXr = createEl("input");
  bindNumberInput(inpXr, () => model.xRate, v => updateProductSection(productId, "product", { xRate: v }), {
    onBlur: () => { inpEur.value = toFixed2(getBundle(productId).product.tmcEur); }
  });
  fXRate.append(lblXr, inpXr);

  // TMC € (readonly)
  const fTmcEur = createEl("div", { className: "dp-field" });
  const lblEur = createEl("label", { text: "TMC €" });
  const inpEur = createEl("input", { attrs: { readonly: "readonly" } });
  inpEur.value = toFixed2(model.tmcEur);
  fTmcEur.append(lblEur, inpEur);

  // Copy Levy
  const fCL = createEl("div", { className: "dp-field" });
  const lblCL = createEl("label", { text: "Copy Levy (€)" });
  const inpCL = createEl("input");
  bindNumberInput(inpCL, () => model.copyLevy, v => updateProductSection(productId, "product", { copyLevy: v }));
  fCL.append(lblCL, inpCL);

  // DEEE
  const fDEEE = createEl("div", { className: "dp-field" });
  const lblDEEE = createEl("label", { text: "DEEE (€)" });
  const inpDEEE = createEl("input");
  bindNumberInput(inpDEEE, () => model.deee, v => updateProductSection(productId, "product", { deee: v }));
  fDEEE.append(lblDEEE, inpDEEE);

  grid.append(fProgram, fRAM, fROM, fType, fTmcUsd, fXRate, fTmcEur, fCL, fDEEE);

  card.append(head, help, grid);
  container.append(card);

  function populateRAM() {
    const m = getBundle(productId).product;
    const opts = m.program ? ramFor(m.program) : [];
    selRAM.innerHTML = "";
    selRAM.append(createEl("option", { attrs: { value: "" }, text: "— Select RAM —" }));
    for (const r of opts) selRAM.append(createEl("option", { attrs: { value: r }, text: r }));
    selRAM.value = m.ram || "";
  }

  function populateROM() {
    const m = getBundle(productId).product;
    const opts = (m.program && m.ram) ? romFor(m.program, m.ram) : [];
    selROM.innerHTML = "";
    selROM.append(createEl("option", { attrs: { value: "" }, text: "— Select ROM —" }));
    for (const r of opts) selROM.append(createEl("option", { attrs: { value: r }, text: r }));
    selROM.value = m.rom || "";
  }

  // Initial
  populateRAM();
  populateROM();
}
