// Create a Program – vertical card form with 2-step UX.
// Step 1: mandatory header (confirm/delete) + auto Program Number
// Step 2: multi PN selection (or filter by Product/RAM/ROM) + table of added products
// All code modular; no side effects on import.

import { loadCustomerSet, loadProductSet } from "/shared/scripts/data.js";
const GEOCOUNTRY_URL = "/data/geocountryset.json";


// ---------------------------------------------------------------------------
// Schema (header + product area fields)
// ---------------------------------------------------------------------------
const PROGRAM_TYPE_OPTIONS = [
  { value: "PR", label: "PR – Price reduction in T1" },
  { value: "SO", label: "SO – Sell Out Promotion in T2" },
  { value: "PP", label: "PP – Price Protection in T1 or T2" },
  { value: "CO", label: "CO – Co-op non contractual" }
];

const GEO_OPTIONS = [
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
];

const VERTICAL_OPTIONS = [
  { value: "B2B",    label: "B2B" },
  { value: "Retail", label: "Retail" },
  { value: "Telco",  label: "Telco" }
];

// ---------------------------------------------------------------------------
// Tiny DOM helper
// ---------------------------------------------------------------------------
function h(tag, props = {}, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  for (const c of children.flat()) el.append(c?.nodeType ? c : document.createTextNode(c ?? ""));
  return el;
}
const unique = (arr) => [...new Set(arr)];

// ---------------------------------------------------------------------------
// Select helpers (preserve selected value(s) on rebuild)
// - supports single and multiple selects (pass selected as string or array)
// ---------------------------------------------------------------------------
function setSelectOptions(selectEl, options = [], placeholder = "Select...", selected = "") {
  const multiple = !!selectEl.multiple;
  const current = multiple ? Array.from(selectEl.selectedOptions).map(o => o.value) : selectEl.value;
  const target = (selected && (multiple ? selected : selected)) || current;

  selectEl.replaceChildren();
  if (!multiple) {
    selectEl.append(h("option", { value: "", disabled: true, selected: !(target && String(target).length) }, placeholder));
  }

  for (const opt of options) {
    const val = typeof opt === "object" ? opt.value : opt;
    const lbl = typeof opt === "object" ? opt.label : opt;
    const o = h("option", { value: val }, lbl);
    if (multiple) {
      if (Array.isArray(target) && target.includes(val)) o.selected = true;
    } else {
      if (val === target) o.selected = true;
    }
    selectEl.append(o);
  }
}

// Pretty label for PN dropdown
const fmtPN = (p) => `${p.PN} — ${p.Description}`;

// ---------------------------------------------------------------------------
// Program Number generator
// CODE + GEO(UPPER) + YEAR + incremental(7 digits)
// Stored per (CODE|GEO|YEAR) in localStorage
// ---------------------------------------------------------------------------
function nextSequence(code, geo, year) {
  const key = `seq:${code}|${geo.toUpperCase()}|${year}`;
  const current = parseInt(localStorage.getItem(key) || "0", 10);
  const next = current + 1;
  localStorage.setItem(key, String(next));
  return String(next).padStart(7, "0");
}
function buildProgramNumber(code, geo, startDateISO) {
  const year = new Date(startDateISO || Date.now()).getFullYear();
  return `${code}${geo.toUpperCase()}${year}${nextSequence(code, geo, year)}`;
}
// ---------------------------------------------------------------------------
// Load countries by GEO from geocountryset.json
// ---------------------------------------------------------------------------
async function loadCountriesByGeo(geo) {
  if (!geo) return [];
  try {
    const res = await fetch(GEOCOUNTRY_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load geocountryset.json");
    const data = await res.json();
    const entry = data.find(e => e.geo === geo);
    return entry ? entry.countries : [];
  } catch (err) {
    console.error("Error loading geocountryset.json:", err);
    return [];
  }
}


// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function renderCreateForm(container) {
  if (!container) return;

  // ----- Build static header fields -----
  const header = [
    ["Program Type", buildSelect("programType", PROGRAM_TYPE_OPTIONS, "Select a program type")],
    ["Geo",          buildSelect("geo", GEO_OPTIONS, "Select a geo")],
    ["Vertical",     buildSelect("vertical", VERTICAL_OPTIONS, "Select a vertical")],
    ["Customer",     buildSelect("customer", [], "Select a customer (choose Geo first)", true)],
    ["Start Day",    h("input", { className: "form-control", type: "date", id: "fld-startDay", name: "startDay" })],
    ["End Day",      h("input", { className: "form-control", type: "date", id: "fld-endDay", name: "endDay" })],
    ["Program Number", h("input", { className: "form-control", type: "text", id: "fld-programNumber", name: "programNumber", placeholder: "Auto after Confirm (editable)" })],
  ];

  // Render header grid
  container.replaceChildren(
    ...header.map(([label, control]) => {
      const row = h("div", { className: "form-row" });
      row.append(
        h("label", { className: "form-label", htmlFor: control.id }, label),
        control
      );
      return row;
    }),
    // Header actions
    h("div", { className: "form-row" },
      h("div", { className: "form-label" }, ""), // empty cell
      h("div", {},
        h("button", { id: "btnConfirm", className: "action-cta", type: "button", style: "margin-right:.5rem" }, "Confirm"),
        h("button", { id: "btnDelete", className: "action-cta", type: "button" }, "Delete")
      )
    )
  );

  // ----- Product area (hidden until Confirm) -----
  const productsSection = h("section", { className: "card", style: "margin-top:1rem; display:none" },
    h("h2", {}, "Products"),
    h("div", { className: "form-row" },
      h("label", { className: "form-label", htmlFor: "fld-pn" }, "PN (multi-select)"),
      h("div", {},
        h("label", { style: "display:inline-flex;align-items:center;gap:.5rem;margin-bottom:.5rem" },
          h("input", { type: "checkbox", id: "chkSelectAll" }),
          "Select all"
        ),
        h("select", { id: "fld-pn", name: "pn", className: "form-control", multiple: true, size: 8 })
      )
    ),
    h("div", { className: "form-row" },
      h("label", { className: "form-label", htmlFor: "fld-product" }, "Product"),
      buildSelect("product", [], "Select a product")
    ),
    h("div", { className: "form-row" },
      h("label", { className: "form-label", htmlFor: "fld-ram" }, "RAM"),
      buildSelect("ram", [], "Choose RAM")
    ),
    h("div", { className: "form-row" },
      h("label", { className: "form-label", htmlFor: "fld-rom" }, "ROM"),
      buildSelect("rom", [], "Choose ROM")
    ),
    h("div", { className: "form-row" },
      h("div", { className: "form-label" }, ""),
      h("div", {},
        h("button", { id: "btnAddProducts", className: "action-cta", type: "button" }, "Add Products")
      )
    )
  );
  container.parentElement.appendChild(productsSection);

  // ----- Table area -----
  const tableWrap = h("section", { className: "card", style: "margin-top:1rem; display:none" },
    h("h2", {}, "Selected products"),
    h("div", { className: "scroll" },
      h("table", { id: "productsTable", style: "width:100%; border-collapse:collapse" },
        h("thead", {},
          trHead([
            "PN", "Description", "RRP", "Promo RRP", "Calculated RRP - VAT (Yes/No)", "Rebate", "Max Quantity", "Total Program Rebate", "Program Number", "Actions"
          ])
        ),
        h("tbody", { id: "productsTbody" })
      )
    ),
    h("div", { style: "margin-top:1rem; text-align:right" },
      h("button", { id: "btnSaveProgram", className: "action-cta", type: "button", disabled: true }, "Save Program")
    )
  );
  container.parentElement.appendChild(tableWrap);

  // ----- References -----
  const programTypeSel = byId("fld-programType");
  const geoSel         = byId("fld-geo");
  const countrySel = buildSelect("country", [], "Select a country");
        geoSel.closest(".form-row").after(
        (() => {
           const row = document.createElement("div");
            row.className = "form-row";
            row.append(
            h("label", { className: "form-label", htmlFor: "fld-country" }, "Country"),
            countrySel
            );
            return row;
        })()
    );

// Update countries when Geo changes
geoSel.addEventListener("change", async () => {
  const countries = await loadCountriesByGeo(geoSel.value);
  setSelectOptions(countrySel, countries.map(c => ({ value: c, label: c })), "Select a country");
});

  const verticalSel    = byId("fld-vertical");
  const customerSel    = byId("fld-customer");
  const startDayInp    = byId("fld-startDay");
  const endDayInp      = byId("fld-endDay");
  const programNumInp  = byId("fld-programNumber");

  const pnSel          = byId("fld-pn");
  const productSel     = byId("fld-product");
  const ramSel         = byId("fld-ram");
  const romSel         = byId("fld-rom");
  const chkSelectAll   = byId("chkSelectAll");
  const btnConfirm     = byId("btnConfirm");
  const btnDelete      = byId("btnDelete");
  const btnAddProducts = byId("btnAddProducts");
  const btnSaveProgram = byId("btnSaveProgram");
  const tbody          = byId("productsTbody");

  // ----- Data -----
  const [customers, products] = await Promise.all([loadCustomerSet(), loadProductSet()]);

  // ----- Start date constraint: today or future -----
  const todayISO = new Date().toISOString().slice(0, 10);
  startDayInp.min = todayISO;

  // ----- Customer filtering (Geo + optional Vertical) -----
  function refreshCustomers() {
    const g = geoSel.value;
    const v = verticalSel.value;
    if (!g) {
      customerSel.disabled = true;
      setSelectOptions(customerSel, [], "Select a customer (choose Geo first)");
      return;
    }
    let list = customers.filter(c => c.geo === g);
    if (v) list = list.filter(c => c.vertical === v);
    const opts = list.map(c => ({ value: c.crmNumber, label: c.customerName }));
    customerSel.disabled = opts.length === 0;
    setSelectOptions(customerSel, opts, opts.length ? `Select a customer (${g}${v ? " · " + v : ""})` : "No customers for this filter");
  }
  geoSel.addEventListener("change", refreshCustomers);
  verticalSel.addEventListener("change", refreshCustomers);
  refreshCustomers();

  // ----- Product/PN dual selection (PN is multi) -----
  function setRamOptions(list, selected = []) {
    const rams = unique(list.map(p => p.RAM)).map(v => ({ value: v, label: v }));
    setSelectOptions(ramSel, rams, "Choose RAM", selected);
  }
  function setRomOptions(list, selected = []) {
    const roms = unique(list.map(p => p.ROM)).map(v => ({ value: v, label: v }));
    setSelectOptions(romSel, roms, "Choose ROM", selected);
  }
  function setPnOptions(list, selected = []) {
    const opts = list.map(p => ({ value: p.PN, label: fmtPN(p) }));
    pnSel.multiple = true;
    pnSel.size = Math.min(12, Math.max(6, opts.length)); // UX size
    setSelectOptions(pnSel, opts, "Select PN(s) or filter by Product/RAM/ROM", selected);
  }
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
  // Select all toggle
  chkSelectAll.addEventListener("change", () => {
    const list = filteredProducts();
    const values = chkSelectAll.checked ? list.map(p => p.PN) : [];
    setPnOptions(list, values);
  });

  // On PN manual change (multi): sync filters if exactly one unique Program/RAM/ROM remains
  pnSel.addEventListener("change", () => {
    const selectedPNs = Array.from(pnSel.selectedOptions).map(o => o.value);
    if (selectedPNs.length === 0) return;
    const selectedProducts = products.filter(p => selectedPNs.includes(p.PN));
    const progs = unique(selectedProducts.map(p => p.Program));
    const rams = unique(selectedProducts.map(p => p.RAM));
    const roms = unique(selectedProducts.map(p => p.ROM));

    // If single value in a dimension, reflect it in its select (keeps UX coherent)
    if (progs.length === 1) productSel.value = progs[0];
    if (rams.length === 1)  ramSel.value = rams[0];
    if (roms.length === 1)  romSel.value = roms[0];
  });

  // Filters change → narrow PN, preserve multi-selection where possible
  function onPRRChange() {
    const baseForOptions = productSel.value
      ? products.filter(p => p.Program === productSel.value)
      : products;
    setRamOptions(baseForOptions, Array.from(ramSel.selectedOptions).map(o => o.value));
    setRomOptions(baseForOptions, Array.from(romSel.selectedOptions).map(o => o.value));

    const list = filteredProducts();
    const current = Array.from(pnSel.selectedOptions).map(o => o.value).filter(v => list.some(p => p.PN === v));
    setPnOptions(list, current);
    chkSelectAll.checked = current.length === list.length && list.length > 0;
  }
  productSel.addEventListener("change", onPRRChange);
  ramSel.addEventListener("change", onPRRChange);
  romSel.addEventListener("change", onPRRChange);

  // Initial fill
  (function initProductArea() {
    const programs = unique(products.map(p => p.Program)).map(v => ({ value: v, label: v }));
    setSelectOptions(productSel, programs, "Select a product");
    setRamOptions(products);
    setRomOptions(products);
    setPnOptions(products);
  })();

  // -------------------------------------------------------------------------
  // Step 1: Confirm / Delete (header)
  // -------------------------------------------------------------------------
  btnConfirm.addEventListener("click", () => {
    const err = validateHeader();
    if (err) {
      alert(err);
      return;
    }
    // Lock header fields
    [programTypeSel, geoSel, verticalSel, customerSel, startDayInp, endDayInp].forEach(el => el.disabled = true);

    // Autogenerate Program Number if empty
    if (!programNumInp.value.trim()) {
      programNumInp.value = buildProgramNumber(programTypeSel.value, geoSel.value, startDayInp.value);
    }

    // Show product area and table
    productsSection.style.display = "";
    tableWrap.style.display = "";
  });

  btnDelete.addEventListener("click", () => {
    // Unlock and clear header
    [programTypeSel, geoSel, verticalSel, customerSel, startDayInp, endDayInp].forEach(el => {
      el.disabled = false;
      el.value = "";
    });
    programNumInp.value = "";
    refreshCustomers();

    // Hide product area and table, clear table rows
    productsSection.style.display = "none";
    tableWrap.style.display = "none";
    tbody.replaceChildren();
    btnSaveProgram.disabled = true;

    // Reset product filters/PNs
    productSel.value = "";
    ramSel.value = "";
    romSel.value = "";
    chkSelectAll.checked = false;
    setRamOptions(products);
    setRomOptions(products);
    setPnOptions(products);
  });

  function validateHeader() {
    if (!PROGRAM_TYPE_OPTIONS.some(o => o.value === programTypeSel.value)) return "Program Type is required.";
    if (!GEO_OPTIONS.some(o => o.value === geoSel.value)) return "Geo is required.";
    if (!VERTICAL_OPTIONS.some(o => o.value === verticalSel.value)) return "Vertical is required.";
    if (!customerSel.value) return "Customer is required.";

    const startISO = startDayInp.value;
    const endISO = endDayInp.value;
    if (!startISO) return "Start Day is required.";
    // Start must be today or in the future
    if (startISO < todayISO) return "Start Day must be today or in the future.";
    // End optional, but if set must be >= start
    if (endISO && endISO < startISO) return "End Day cannot be earlier than Start Day.";
    return "";
  }

  // -------------------------------------------------------------------------
  // Step 2: Add Products → table
  // -------------------------------------------------------------------------
  btnAddProducts.addEventListener("click", () => {
    const selectedPNs = Array.from(pnSel.selectedOptions).map(o => o.value);
    const subset = selectedPNs.length
      ? products.filter(p => selectedPNs.includes(p.PN))
      : filteredProducts(); // if none explicitly selected, take the filtered list

    if (subset.length === 0) {
      alert("Please select at least one PN or narrow filters to a non-empty list.");
      return;
    }

    // Add rows (avoid duplicates by PN)
    const existing = new Set(Array.from(tbody.querySelectorAll('tr')).map(tr => tr.dataset.pn));
    subset.forEach(p => {
      if (existing.has(p.PN)) return;
      tbody.append(rowForProduct(p, programNumInp.value));
      existing.add(p.PN);
    });

    btnSaveProgram.disabled = tbody.children.length === 0;
  });

  // Save Program (stub – next step will persist to /data)
  btnSaveProgram.addEventListener("click", () => {
    const header = {
      programType: programTypeSel.value,
      geo: geoSel.value,
      vertical: verticalSel.value,
      customer: customerSel.value, // CRM number as value
      startDay: startDayInp.value,
      endDay: endDayInp.value || null,
      programNumber: programNumInp.value
    };
    const lines = Array.from(tbody.querySelectorAll("tr")).map(tr => ({
      pn: tr.dataset.pn,
      description: tr.querySelector('[data-col="desc"]').textContent,
      rrp: numVal(tr.querySelector('[data-col="rrp"]')),
      promoRrp: numVal(tr.querySelector('[data-col="promoRrp"]')),
      vatOnRrp: tr.querySelector('[data-col="vat"]').value, // "Yes"/"No"
      rebate: numVal(tr.querySelector('[data-col="rebate"]')),
      maxQty: numVal(tr.querySelector('[data-col="maxQty"]')),
      totalProgramRebate: numVal(tr.querySelector('[data-col="total"]')),
      programNumber: tr.querySelector('[data-col="lineProgramNumber"]').value || header.programNumber
    }));

    // Minimal validation for table
    if (lines.length === 0) return alert("No products added.");
    // Here we would persist to /data/... (next iteration)
    console.log({ header, lines });
    alert("Program ready to be saved (persistence comes next). Check console for payload.");
  });

  // -------------------------------------------------------------------------
  // Helpers (table rows, formatting)
  // -------------------------------------------------------------------------
  function rowForProduct(p, programNumber) {
    const tr = h("tr", { "data-pn": p.PN, style: "border-top:1px solid var(--card-border)" },
      td(p.PN),
      td(p.Description, { "data-col": "desc" }),
      tdInputNumber("rrp", 0),
      tdInputNumber("promoRrp", 0),
      tdSelect("vat", ["Yes", "No"], "No"),
      tdInputNumber("rebate", 0, onRecalc),
      tdInputNumber("maxQty", 0, onRecalc),
      tdReadOnly("total", "0.00"),
      tdInputText("lineProgramNumber", programNumber),
      tdActionRemove()
    );
    return tr;

    function onRecalc() {
      const rebate = numVal(tr.querySelector('[data-col="rebate"]'));
      const qty = numVal(tr.querySelector('[data-col="maxQty"]'));
      tr.querySelector('[data-col="total"]').textContent = (rebate * qty).toFixed(2);
    }
  }

  function trHead(cols) { return h("tr", {}, ...cols.map(c => h("th", { style: thStyle() }, c))); }
  function td(txt, data = {}) { return h("td", { style: tdStyle(), ...data }, txt); }
  function tdActionRemove() {
    const btn = h("button", { type: "button", className: "action-cta" }, "Remove");
    const cell = h("td", { style: tdStyle() }, btn);
    btn.addEventListener("click", () => {
      btn.closest("tr")?.remove();
      btnSaveProgram.disabled = tbody.children.length === 0;
    });
    return cell;
  }
  function tdInputNumber(col, initial = 0, onInput) {
    const inp = h("input", { type: "number", step: "0.01", value: initial, className: "form-control", style: "min-width:120px" });
    const cell = h("td", { style: tdStyle(), "data-col": col }, inp);
    if (onInput) inp.addEventListener("input", onInput);
    return cell;
  }
  function tdInputText(col, val = "") {
    const inp = h("input", { type: "text", value: val, className: "form-control", style: "min-width:160px" });
    return h("td", { style: tdStyle(), "data-col": col }, inp);
  }
  function tdReadOnly(col, val = "") {
    const span = h("span", {}, val);
    return h("td", { style: tdStyle(), "data-col": col }, span);
  }
  function tdSelect(col, opts, def) {
    const sel = h("select", { className: "form-control" }, ...opts.map(o => h("option", { value: o, selected: o === def }, o)));
    return h("td", { style: tdStyle(), "data-col": col }, sel);
  }
  function tdStyle() { return "padding:.5rem;border-top:1px solid var(--card-border);text-align:center"; }
  function thStyle() { return "padding:.5rem;border-bottom:1px solid var(--card-border);text-align:center;font-weight:600"; }
  function tr(...cells) { return h("tr", {}, ...cells); }
  function byId(id) { return document.getElementById(id); }
  function numVal(tdOrInp) {
    if (!tdOrInp) return 0;
    const el = tdOrInp.tagName === "TD" ? tdOrInp.querySelector("input,select,span") || tdOrInp : tdOrInp;
    const v = el.tagName === "SPAN" ? el.textContent : el.value;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }

  // Utility to build labeled selects with id/name convention
  function buildSelect(key, options, placeholder, disabled = false) {
    const sel = h("select", { className: "form-control", id: `fld-${key}`, name: key, disabled });
    setSelectOptions(sel, options, placeholder);
    return sel;
  }
}
