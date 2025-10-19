// Vertical card form renderer for "Create a Program".
// Pure modular code – no side effects on import.

import { loadCustomerSet, loadProductSet } from "/shared/scripts/data.js";

// --- Form schema ------------------------------------------------------------
const SCHEMA = [
  {
    label: "Program Type",
    key: "programType",
    type: "select",
    placeholder: "Select a program type",
    options: [
      { value: "PR", label: "PR – Price reduction in T1" },
      { value: "SO", label: "SO – Sell Out Promotion in T2" },
      { value: "PP", label: "PP – Price Protection in T1 or T2" },
      { value: "CO", label: "CO – Co-op non contractual" }
    ]
  },
  {
    label: "Geo",
    key: "geo",
    type: "select",
    placeholder: "Select a geo",
    options: [
      { value: "Benelux",      label: "Benelux" },
      { value: "Central Asia", label: "Central Asia" },
      { value: "DACH",         label: "DACH (Germany, Austria, Switzerland)" },
      { value: "France",       label: "France" },
      { value: "Iberia",       label: "Iberia (Spain & Portugal)" },
      { value: "Italy",        label: "Italy" },
      { value: "MEA",          label: "MEA (Middle East & Africa)" },
      { value: "Nordics",      label: "Nordics" },
      { value: "Poland",       label: "Poland" },
      { value: "SEE",          label: "SEE (South East Europe)" },
      { value: "UKI",          label: "UKI (United Kingdom & Ireland)" }
    ]
  },
  {
    label: "Vertical",
    key: "vertical",
    type: "select",
    placeholder: "Select a vertical (optional)",
    options: [
      { value: "B2B",    label: "B2B" },
      { value: "Retail", label: "Retail" },
      { value: "Telco",  label: "Telco" }
    ]
  },
  // Customer is dynamic; filtered by Geo (and optionally Vertical)
  { label: "Customer", key: "customer", type: "select", placeholder: "Select a customer (choose Geo first)", options: [], disabled: true },

  // --- Product & SKU selection (dual path) ---------------------------------
  // PN select (shows PN — Description). Syncs with Product/RAM/ROM.
  { label: "PN",      key: "pn",      type: "select", placeholder: "Select PN or filter by Product/RAM/ROM", options: [], disabled: false },
  // Product becomes a dynamic select (program in productset)
  { label: "Product", key: "product", type: "select", placeholder: "Select a product", options: [], disabled: false },
  // RAM/ROM are selects but their options narrow based on Product/PN/ROM/RAM combination
  { label: "RAM",     key: "ram",     type: "select", placeholder: "Choose RAM", options: [], disabled: false },
  { label: "ROM",     key: "rom",     type: "select", placeholder: "Choose ROM", options: [], disabled: false },

  // --- Rest of the form -----------------------------------------------------
  { label: "Activity",  key: "activity",  type: "text",   placeholder: "Describe the activity" },
  { label: "Start Day", key: "startDay",  type: "date" },
  { label: "End Day",   key: "endDay",    type: "date" },
  { label: "RRP",       key: "rrp",       type: "number", placeholder: "0.00" },
  { label: "Promo RRP", key: "promoRrp",  type: "number", placeholder: "0.00" },
  { label: "Calculated on RRP - VAT (Yes/No)", key: "calcOnRrpVat", type: "select", placeholder: "Select one", options: ["Yes","No"] },
  { label: "Rebate",         key: "rebate",     type: "number", placeholder: "0.00" },
  { label: "Max Quantity",   key: "maxQty",     type: "number", placeholder: "0" },
  { label: "Total Program Rebate", key: "totalRebate", type: "number", placeholder: "0.00" },
  { label: "Program Number", key: "programNumber", type: "text", placeholder: "Auto/Manual code" }
];

// --- Tiny DOM helper --------------------------------------------------------
function h(tag, props = {}, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  for (const c of children.flat()) el.append(c?.nodeType ? c : document.createTextNode(c ?? ""));
  return el;
}

// --- Control helpers --------------------------------------------------------
function setSelectOptions(sel, options = [], placeholder = "Select...") {
  sel.replaceChildren();
  sel.append(h("option", { value: "", disabled: true, selected: true }, placeholder));
  for (const opt of options) {
    if (typeof opt === "object") sel.append(h("option", { value: opt.value }, opt.label));
    else sel.append(h("option", { value: opt }, opt));
  }
}

function buildControl(field) {
  const common = { className: "form-control", name: field.key, id: `fld-${field.key}` };

  if (field.type === "select") {
    const sel = h("select", { ...common, disabled: !!field.disabled });
    setSelectOptions(sel, field.options, field.placeholder ?? "Select...");
    return sel;
  }
  if (field.type === "date")   return h("input", { ...common, type: "date" });
  if (field.type === "number") return h("input", { ...common, type: "number", step: "0.01", placeholder: field.placeholder ?? "0" });
  return h("input", { ...common, type: "text", placeholder: field.placeholder ?? "" });
}

// --- Public API -------------------------------------------------------------
export async function renderCreateForm(container) {
  if (!container) return;

  // Build static rows first
  const rows = SCHEMA.map(f => [
    h("label", { className: "form-label", htmlFor: `fld-${f.key}` }, f.label),
    buildControl(f)
  ]).flat();

  container.replaceChildren(
    ...SCHEMA.map((f, i) => {
      const row = h("div", { className: "form-row" });
      row.append(rows[i * 2], rows[i * 2 + 1]);
      return row;
    })
  );

  // --- References for dynamic behavior -------------------------------------
  const geoSel      = container.querySelector('#fld-geo');
  const verticalSel = container.querySelector('#fld-vertical');
  const custSel     = container.querySelector('#fld-customer');

  const pnSel       = container.querySelector('#fld-pn');
  const productSel  = container.querySelector('#fld-product');
  const ramSel      = container.querySelector('#fld-ram');
  const romSel      = container.querySelector('#fld-rom');

  // --- Load data ------------------------------------------------------------
  const [customers, products] = await Promise.all([
    loadCustomerSet(),
    loadProductSet()
  ]);

  // ---- Customer filtering (Geo + optional Vertical) -----------------------
  const refreshCustomers = () => {
    const g  = geoSel.value;
    const v  = verticalSel.value;

    if (!g) {
      custSel.disabled = true;
      setSelectOptions(custSel, [], "Select a customer (choose Geo first)");
      return;
    }

    let list = customers.filter(c => c.geo === g);
    if (v) list = list.filter(c => c.vertical === v);

    const opts = list.map(c => ({ value: c.crmNumber, label: c.customerName }));
    custSel.disabled = opts.length === 0;
    setSelectOptions(
      custSel,
      opts,
      opts.length
        ? (v ? `Select a customer (${g} · ${v})` : `Select a customer (${g})`)
        : "No customers match the selected filters"
    );
  };

  geoSel.addEventListener('change', refreshCustomers);
  verticalSel.addEventListener('change', refreshCustomers);
  refreshCustomers();

  // ---- Product/PN dual selection ------------------------------------------
  // Helpers to build unique sets filtered
  const unique = (arr) => [...new Set(arr)];
  const fmtPN = (p) => `${p.PN} — ${p.Description}`; // shows PN and Description

  // Populate base options
  const initProductOptions = () => {
    const prods = unique(products.map(p => p.Program)).map(v => ({ value: v, label: v }));
    setSelectOptions(productSel, prods, "Select a product");
  };

  const initPNOptions = (list = products) => {
    const opts = list.map(p => ({ value: p.PN, label: fmtPN(p) }));
    setSelectOptions(pnSel, opts, "Select PN or filter by Product/RAM/ROM");
  };

  const setRamOptions = (list) => {
    const rams = unique(list.map(p => p.RAM)).map(v => ({ value: v, label: v }));
    setSelectOptions(ramSel, rams, "Choose RAM");
  };

  const setRomOptions = (list) => {
    const roms = unique(list.map(p => p.ROM)).map(v => ({ value: v, label: v }));
    setSelectOptions(romSel, roms, "Choose ROM");
  };

  // Filter products based on current selections
  const filteredProducts = () => {
    const selProduct = productSel.value;
    const selRam = ramSel.value;
    const selRom = romSel.value;

    return products.filter(p =>
      (!selProduct || p.Program === selProduct) &&
      (!selRam || p.RAM === selRam) &&
      (!selRom || p.ROM === selRom)
    );
  };

  // When the user changes PN: sync Product/RAM/ROM to match that SKU
  const onPNChange = () => {
    const pn = pnSel.value;
    if (!pn) return;

    const p = products.find(x => x.PN === pn);
    if (!p) return;

    // First update dependent selects with filtered options containing this product
    // so the values are guaranteed to exist.
    const listByProduct = products.filter(x => x.Program === p.Program);
    setRamOptions(listByProduct);
    setRomOptions(listByProduct);

    // Set values
    productSel.value = p.Program;
    ramSel.value = p.RAM;
    romSel.value = p.ROM;

    // Finally, narrow PN to the coherent subset (optional, but keeps list short)
    const list = filteredProducts();
    initPNOptions(list);
    pnSel.value = pn; // keep the current PN selected
  };

  // When the user changes Product/RAM/ROM: update the PN list and also narrow RAM/ROM
  const onPRRChange = () => {
    const list = filteredProducts();

    // Narrow PN list to the current filter
    initPNOptions(list);

    // Narrow RAM/ROM options to what exists for the selected product
    const baseForOptions = productSel.value
      ? products.filter(p => p.Program === productSel.value)
      : products;

    setRamOptions(baseForOptions);
    setRomOptions(baseForOptions);

    // If current RAM/ROM are now invalid, clear them
    if (ramSel.value && !baseForOptions.some(p => p.RAM === ramSel.value)) ramSel.value = "";
    if (romSel.value && !baseForOptions.some(p => p.ROM === romSel.value)) romSel.value = "";

    // If exactly one PN matches, auto-select it; otherwise leave placeholder
    if (list.length === 1) pnSel.value = list[0].PN;
    else pnSel.value = "";
  };

  // Initial fill
  initProductOptions();
  setRamOptions(products);
  setRomOptions(products);
  initPNOptions(products);

  // Wire events
  pnSel.addEventListener('change', onPNChange);
  productSel.addEventListener('change', onPRRChange);
  ramSel.addEventListener('change', onPRRChange);
  romSel.addEventListener('change', onPRRChange);
}
