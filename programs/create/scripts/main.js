// Vertical card form renderer for "Create a Program".
// Pure modular code – no side effects on import.

import { loadCustomerSet } from "/shared/scripts/data.js";

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
  { label: "Customer", key: "customer", type: "select", placeholder: "Select a customer (choose Geo first)", options: [], disabled: true },

  { label: "Activity",  key: "activity",  type: "text",   placeholder: "Describe the activity" },
  { label: "Start Day", key: "startDay",  type: "date" },
  { label: "End Day",   key: "endDay",    type: "date" },
  { label: "PN",        key: "pn",        type: "text",   placeholder: "Part Number" },
  { label: "Product",   key: "product",   type: "text",   placeholder: "Model / SKU" },
  { label: "RAM",       key: "ram",       type: "select", placeholder: "Choose RAM", options: ["2 GB","3 GB","4 GB","6 GB","8 GB","12 GB"] },
  { label: "ROM",       key: "rom",       type: "select", placeholder: "Choose ROM", options: ["32 GB","64 GB","128 GB","256 GB","512 GB"] },
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

// --- Control factory --------------------------------------------------------
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

  // Refs for dynamic behavior
  const geoSel  = container.querySelector('#fld-geo');
  const custSel = container.querySelector('#fld-customer');

  // Load customers once
  const customers = await loadCustomerSet();

  const refreshCustomers = () => {
    const g = geoSel.value;
    if (!g) {
      custSel.disabled = true;
      setSelectOptions(custSel, [], "Select a customer (choose Geo first)");
      return;
    }
    const list = customers
      .filter(c => c.geo === g)
      .map(c => ({ value: c.crmNumber, label: c.customerName }));
    custSel.disabled = list.length === 0;
    setSelectOptions(custSel, list, list.length ? "Select a customer" : "No customers for this geo");
  };

  geoSel.addEventListener('change', refreshCustomers);
  refreshCustomers();
}
