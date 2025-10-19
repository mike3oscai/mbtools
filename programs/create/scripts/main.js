// Vertical card form renderer for "Create a Program".
// Pure modular code – no side effects on import.

import { loadCustomerSet, loadProductSet } from "/shared/scripts/data.js";

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------
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
  // PN shows "PN — Description" and syncs with Product/RAM/ROM
  { label: "PN",      key: "pn",      type: "select", placeholder: "Select PN or filter by Product/RAM/ROM", options: [], disabled: false },
  // Product, RAM and ROM act as filters that narrow the PN list
  { label: "Product", key: "product", type: "select", placeholder: "Select a product", options: [], disabled: false },
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

// ---------------------------------------------------------------------------
// Tiny DOM helper
// ---------------------------------------------------------------------------
function h(tag, props = {}, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  for (const c of children.flat()) el.append(c?.nodeType ? c : document.createTextNode(c ?? ""));
  return el;
}

// ---------------------------------------------------------------------------
// Select helpers (preserve selection when rebuilding options)
// ---------------------------------------------------------------------------
function setSelectOptions(sel, options = [], placeholder = "Select...", selectedValue = "") {
  const keep = sel.value;                 // remember current value if no explicit selectedValue
  const target = selectedValue || keep;   // prefer the explicit one

  sel.replaceChildren();
  sel.append(h("option", { value: "", disabled: true, selected: !target }, placeholder));

  for (const opt of options) {
    if (typeof opt === "object") {
      const o = h("option", { value: opt.value }, opt.label);
      if (opt.value === target) o.selected = true;
      sel.append(o);
    } else {
      const o = h("option", { value: opt }, opt);
      if (opt === target) o.selected = true;
      sel.append(o);
    }
  }
}

const unique = (arr) => [...new Set(arr)];
const fmtPN = (p) => `${p.PN} — ${p.Description}`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function renderCreateForm(container) {
  if (!container) return;

  // 1) Render static form (labels + empty controls based on schema)
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

  // 2) Grab references we will operate on
  const geoSel      = container.querySelector('#fld-geo');
  const verticalSel = container.querySelector('#fld-vertical');
  const custSel     = container.querySelector('#fld-customer');

  const pnSel       = container.querySelector('#fld-pn');
  const productSel  = container.querySelector('#fld-product');
  const ramSel      = container.querySelector('#fld-ram');
  const romSel      = container.querySelector('#fld-rom');

  // 3) Load data
  const [customers, products] = await Promise.all([
    loadCustomerSet(),
    loadProductSet()
  ]);

  // ------------------ Customers: Geo + optional Vertical --------------------
  const refreshCustomers = () => {
    const g = geoSel.value;
    const v = verticalSel.value;

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

  // ------------------ Product/PN dual selection -----------------------------
  // Helpers to fill dependent selects
  function setRamOptions(list, selected = "") {
    const rams = unique(list.map(p => p.RAM)).map(v => ({ value: v, label: v }));
    setSelectOptions(ramSel, rams, "Choose RAM", selected);
  }

  function setRomOptions(list, selected = "") {
    const roms = unique(list.map(p => p.ROM)).map(v => ({ value: v, label: v }));
    setSelectOptions(romSel, roms, "Choose ROM", selected);
  }

  function setPnOptions(list, selected = "") {
    const opts = list.map(p => ({ value: p.PN, label: fmtPN(p) }));
    setSelectOptions(pnSel, opts, "Select PN or filter by Product/RAM/ROM", selected);
  }

  // Current filtered set based on Product/RAM/ROM selections
  function filteredProducts() {
    const selProduct = productSel.value;
    const selRam = ramSel.value;
    const selRom = romSel.value;

    return products.filter(p =>
      (!selProduct || p.Program === selProduct) &&
      (!selRam || p.RAM === selRam) &&
      (!selRom || p.ROM === selRom)
    );
  }

  // PN → sync Product/RAM/ROM to that exact SKU
  function onPNChange() {
    const pn = pnSel.value;
    if (!pn) return;
    const p = products.find(x => x.PN === pn);
    if (!p) return;

    // Set Product first to limit the option space of RAM/ROM
    productSel.value = p.Program;

    // Rebuild RAM/ROM with options for the selected product and select exact values
    const listByProduct = products.filter(x => x.Program === p.Program);
    setRamOptions(listByProduct, p.RAM);
    setRomOptions(listByProduct, p.ROM);

    // Rebuild PN to the coherent subset
    const list = filteredProducts();
    setPnOptions(list, pn);  // keep PN selected
  }

  // Product/RAM/ROM → narrow PN, preserve current selections if valid
  function onPRRChange() {
    // Base option space for RAM/ROM depends on selected Product (if any)
    const baseForOptions = productSel.value
      ? products.filter(p => p.Program === productSel.value)
      : products;

    // Preserve current values if they still exist
    const currentRAM = ramSel.value;
    const currentROM = romSel.value;

    setRamOptions(baseForOptions, currentRAM);
    setRomOptions(baseForOptions, currentROM);

    // If current RAM/ROM became invalid, clear them
    if (ramSel.value && !baseForOptions.some(p => p.RAM === ramSel.value)) ramSel.value = "";
    if (romSel.value && !baseForOptions.some(p => p.ROM === romSel.value)) romSel.value = "";

    // Now compute filtered list and rebuild PN accordingly
    const list = filteredProducts();
    setPnOptions(list, list.length === 1 ? list[0].PN : "");

    // If exactly one PN matches, auto-select it
    if (list.length === 1) pnSel.value = list[0].PN;
  }

  // Initial fill
  (function initProductArea() {
    const programs = unique(products.map(p => p.Program)).map(v => ({ value: v, label: v }));
    setSelectOptions(productSel, programs, "Select a product");
    setRamOptions(products);
    setRomOptions(products);
    setPnOptions(products);
  })();

  // Wire events
  pnSel.addEventListener('change', onPNChange);
  productSel.addEventListener('change', onPRRChange);
  ramSel.addEventListener('change', onPRRChange);
  romSel.addEventListener('change', onPRRChange);
}

// ---------------------------------------------------------------------------
// Control factory – builds each control based on the schema field
// ---------------------------------------------------------------------------
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
