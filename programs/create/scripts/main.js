// Create a Program – vertical card form with 2-step UX.
// Step 1: mandatory header (confirm/delete) + auto Program Number
// Step 2: multi PN selection (or filter by Product/RAM/ROM) + table of added products
// Adds: Country (from /data/geocountryset.json) + VAT loader and Rebate calc when VAT=Yes.

import { loadCustomerSet, loadProductSet, loadVatSet } from "/shared/scripts/data.js";
const GEOCOUNTRY_URL = "/data/geocountryset.json";

// ---------------------------------------------------------------------------
// Options
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
// Tiny helpers
// ---------------------------------------------------------------------------
function h(tag, props = {}, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  for (const c of children.flat()) el.append(c?.nodeType ? c : document.createTextNode(c ?? ""));
  return el;
}
const unique = (arr) => [...new Set(arr)];
const fmtPN = (p) => `${p.PN} — ${p.Description}`;

// ---------------------------------------------------------------------------
// Select helpers (preserve selection; supports single/multiple)
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
// Countries loader from geocountryset.json
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

  // ----- Build static header fields (new order + Country) -----
  const programTypeSel = buildSelect("programType", PROGRAM_TYPE_OPTIONS, "Select a program type");
  const geoSel         = buildSelect("geo", GEO_OPTIONS, "Select a geo");
  const verticalSel    = buildSelect("vertical", VERTICAL_OPTIONS, "Select a vertical");
  const customerSel    = buildSelect("customer", [], "Select a customer (choose Geo first)", true);
  const startDayInp    = h("input", { className: "form-control", type: "date", id: "fld-startDay", name: "startDay" });
  const endDayInp      = h("input", { className: "form-control", type: "date", id: "fld-endDay", name: "endDay" });
  const programNumInp  = h("input", { className: "form-control", type: "text", id: "fld-programNumber", name: "programNumber", placeholder: "Auto after Confirm (editable)" });
  const countrySel     = buildSelect("country", [], "Select a country"); // injected after Geo

  const headerRows = [
    ["Program Type", programTypeSel],
    ["Geo",          geoSel],
    ["Country",      countrySel],
    ["Vertical",     verticalSel],
    ["Customer",     customerSel],
    ["Start Day",    startDayInp],
    ["End Day",      endDayInp],
    ["Program Number", programNumInp]
  ];

  // Render header grid + actions
  container.replaceChildren(
    ...headerRows.map(([label, control]) => {
      const row = h("div", { className: "form-row" });
      row.append(
        h("label", { className: "form-label", htmlFor: control.id }, label),
        control
      );
      return row;
    }),
    h("div", { className: "form-row" },
      h("div", { className: "form-label" }, ""),
      h("div", {},
        h("button", { id: "btnConfirm", className: "action-cta", type: "button", style: "margin-right:.5rem" }, "Confirm"),
        h("button", { id: "btnDelete", className: "action-cta", type: "button" }, "Delete")
      )
    )
  );

  // Product area (hidden until Confirm)
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

  // Selected products table
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

  // Refs
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

  // Data
  const [customers, products, vatset] = await Promise.all([
    loadCustomerSet(),
    loadProductSet(),
    loadVatSet()
  ]);

  // VAT lookup by country
  function getVatForCountry(country) {
    if (!country) return null;
    const entry = vatset.find(v => v.country === country);
    return entry && typeof entry.vat === "number" ? entry.vat : null;
  }

  // Header constraints/behavior
  const todayISO = new Date().toISOString().slice(0, 10);
  startDayInp.min = todayISO;

  // Geo -> Countries
  geoSel.addEventListener("change", async () => {
    const countries = await loadCountriesByGeo(geoSel.value);
    setSelectOptions(countrySel, countries.map(c => ({ value: c, label: c })), "Select a country");
    // Also refresh customers when geo changes
    refreshCustomers();
  });

  // Customers (Geo + optional Vertical)
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
  verticalSel.addEventListener("change", refreshCustomers);

  // Initial load for countries if Geo preset (optional)
  if (geoSel.value) {
    const countries = await loadCountriesByGeo(geoSel.value);
    setSelectOptions(countrySel, countries.map(c => ({ value: c, label: c })), "Select a country");
  }

  // Product/PN dual selection (PN is multi)
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
    pnSel.size = Math.min(12, Math.max(6, opts.length));
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
  chkSelectAll.addEventListener("change", () => {
    const list = filteredProducts();
    const values = chkSelectAll.checked ? list.map(p => p.PN) : [];
    setPnOptions(list, values);
  });
  pnSel.addEventListener("change", () => {
    const selectedPNs = Array.from(pnSel.selectedOptions).map(o => o.value);
    if (selectedPNs.length === 0) return;
    const selectedProducts = products.filter(p => selectedPNs.includes(p.PN));
    const progs = unique(selectedProducts.map(p => p.Program));
    const rams = unique(selectedProducts.map(p => p.RAM));
    const roms = unique(selectedProducts.map(p => p.ROM));
    if (progs.length === 1) productSel.value = progs[0];
    if (rams.length === 1)  ramSel.value = rams[0];
    if (roms.length === 1)  romSel.value = roms[0];
  });
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

  // Init product filters
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
  const today = todayISO;
  byId("btnConfirm").addEventListener("click", () => {
    const err = validateHeader();
    if (err) return alert(err);

    // Lock header fields
    [programTypeSel, geoSel, countrySel, verticalSel, customerSel, startDayInp, endDayInp].forEach(el => el.disabled = true);

    // Autogenerate Program Number if empty
    if (!programNumInp.value.trim()) {
      programNumInp.value = buildProgramNumber(programTypeSel.value, geoSel.value, startDayInp.value);
    }

    // Show product area and table
    productsSection.style.display = "";
    tableWrap.style.display = "";
  });

  byId("btnDelete").addEventListener("click", () => {
    // Unlock and clear header
    [programTypeSel, geoSel, countrySel, verticalSel, customerSel, startDayInp, endDayInp].forEach(el => {
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
    if (!countrySel.value) return "Country is required.";
    if (!VERTICAL_OPTIONS.some(o => o.value === verticalSel.value)) return "Vertical is required.";
    if (!customerSel.value) return "Customer is required.";

    const startISO = startDayInp.value;
    const endISO = endDayInp.value;
    if (!startISO) return "Start Day is required.";
    if (startISO < today) return "Start Day must be today or in the future.";
    if (endISO && endISO < startISO) return "End Day cannot be earlier than Start Day.";
    return "";
  }

  // -------------------------------------------------------------------------
  // Step 2: Add Products → table + VAT-based rebate calc
  // -------------------------------------------------------------------------
  btnAddProducts.addEventListener("click", () => {
    const selectedPNs = Array.from(pnSel.selectedOptions).map(o => o.value);
    const subset = selectedPNs.length
      ? products.filter(p => selectedPNs.includes(p.PN))
      : filteredProducts();

    if (subset.length === 0) {
      alert("Please select at least one PN or narrow filters to a non-empty list.");
      return;
    }

    // Add rows (avoid duplicates by PN)
    const existing = new Set(Array.from(tbody.querySelectorAll('tr')).map(tr => tr.dataset.pn));
    subset.forEach(p => {
      if (existing.has(p.PN)) return;
      const tr = rowForProduct(p, programNumInp.value);
      tbody.append(tr);
      existing.add(p.PN);
      // Initial calc (in case VAT=Yes and RRP already filled later)
      recalcRow(tr, countrySel);
    });

    btnSaveProgram.disabled = tbody.children.length === 0;
  });

  // Save Program (payload ready; persistence next step)
  btnSaveProgram.addEventListener("click", () => {
    const header = {
      programType: programTypeSel.value,
      geo: geoSel.value,
      country: countrySel.value,
      vertical: verticalSel.value,
      customer: customerSel.value, // CRM number
      startDay: startDayInp.value,
      endDay: endDayInp.value || null,
      programNumber: programNumInp.value
    };

    const lines = Array.from(tbody.querySelectorAll("tr")).map(tr => ({
      pn: tr.dataset.pn,
      description: getCell(tr, "desc")?.textContent ?? "",
      rrp: numVal(getCell("input", tr, "rrp")),
      promoRrp: numVal(getCell("input", tr, "promoRrp")),
      vatOnRrp: (getCell("select", tr, "vat")?.value) || "No",
      rebate: numVal(getCell("input", tr, "rebate")),
      maxQty: numVal(getCell("input", tr, "maxQty")),
      totalProgramRebate: numVal(getCell("span", tr, "total")),
      programNumber: (getCell("input", tr, "lineProgramNumber")?.value) || header.programNumber
    }));

    if (lines.length === 0) return alert("No products added.");
    console.log({ header, lines });
    alert("Program ready to be saved (persistence comes next). Check console for payload.");
  });

  // ---------------- Table row helpers + Rebate calc -------------------------
  function rowForProduct(p, programNumber) {
    const tr = h("tr", { "data-pn": p.PN, style: "border-top:1px solid var(--card-border)" },
      td(p.PN),
      td(p.Description, { "data-col": "desc" }),
      tdInputNumber("rrp", 0, onAnyChange),
      tdInputNumber("promoRrp", 0, onAnyChange),
      tdSelect("vat", ["Yes", "No"], "No", onAnyChange),
      tdInputNumber("rebate", 0, onAnyChange), // auto-filled & disabled when VAT=Yes
      tdInputNumber("maxQty", 0, onAnyChange),
      tdReadOnly("total", "0.00"),
      tdInputText("lineProgramNumber", programNumber),
      tdActionRemove()
    );
    return tr;

    function onAnyChange() {
      recalcRow(tr, countrySel);
    }
  }

  // Core recalculation for a row (VAT-Yes path)
  function recalcRow(tr, countrySelRef) {
    // Defensive selectors
    const rrpInput    = getCell("input", tr, "rrp");
    const promoInput  = getCell("input", tr, "promoRrp");
    const vatSelect   = getCell("select", tr, "vat");
    const rebateInput = getCell("input", tr, "rebate");
    const qtyInput    = getCell("input", tr, "maxQty");
    const totalSpan   = getCell("span", tr, "total");

    // If structure is incomplete, bail out gracefully
    if (!rrpInput || !promoInput || !vatSelect || !rebateInput || !qtyInput || !totalSpan) return;

    const rrp   = parseFloat(rrpInput.value || "0") || 0;
    const promo = parseFloat(promoInput.value || "0") || 0;
    const qty   = parseFloat(qtyInput.value || "0") || 0;

    if (vatSelect.value === "Yes") {
      const vatRate = getVatForCountry(countrySelRef?.value);
      if (!vatRate || vatRate <= 0) {
        rebateInput.value = "0.00";
        rebateInput.disabled = true;
      } else {
        // Spec: Rebate = (RRP - Promo RRP) / VAT
        const vatDec = vatRate / 100;
        const rebate = (rrp - promo) / (1 + vatDec);
        rebateInput.value = rebate.toFixed(2);
        rebateInput.disabled = true;
      }
    } else {
      // Manual rebate when VAT = No
      rebateInput.disabled = false;
    }

    const rebateVal = parseFloat(rebateInput.value || "0") || 0;
    totalSpan.textContent = (rebateVal * qty).toFixed(2);
  }

  function recalcAllRows(tbodyEl, countrySelRef) {
    Array.from(tbodyEl.querySelectorAll("tr")).forEach(tr => recalcRow(tr, countrySelRef));
  }

  // Recalc all rows if Country changes (affects VAT rate)
  countrySel.addEventListener("change", () => {
    recalcAllRows(tbody, countrySel);
  });

  // ---------------- small HTML helpers for table ----------------------------
  function trHead(cols) { return h("tr", {}, ...cols.map(c => h("th", { style: thStyle() }, c))); }

  function td(txt, data = {}) {
    const el = h("td", { style: tdStyle() }, txt);
    if (data && data["data-col"]) el.dataset.col = data["data-col"];
    return el;
  }

  function tdInputNumber(col, initial = 0, onInput) {
    const inp = h("input", { type: "number", step: "0.01", value: initial, className: "form-control", style: "min-width:120px" });
    const cell = h("td", { style: tdStyle() }, inp);
    cell.dataset.col = col;
    if (onInput) inp.addEventListener("input", onInput);
    return cell;
  }

  function tdInputText(col, val = "") {
    const inp = h("input", { type: "text", value: val, className: "form-control", style: "min-width:160px" });
    const cell = h("td", { style: tdStyle() }, inp);
    cell.dataset.col = col;
    return cell;
  }

  function tdReadOnly(col, val = "") {
    const span = h("span", {}, val);
    const cell = h("td", { style: tdStyle() }, span);
    cell.dataset.col = col;
    return cell;
  }

  function tdSelect(col, opts, def, onChange) {
    const sel = h("select", { className: "form-control" },
      ...opts.map(o => h("option", { value: o, selected: o === def }, o))
    );
    if (onChange) sel.addEventListener("change", onChange);
    const cell = h("td", { style: tdStyle() }, sel);
    cell.dataset.col = col;
    return cell;
  }

  function tdActionRemove() {
    const btn = h("button", { type: "button", className: "action-cta" }, "Remove");
    const cell = h("td", { style: tdStyle() }, btn);
    btn.addEventListener("click", () => {
      btn.closest("tr")?.remove();
      btnSaveProgram.disabled = tbody.children.length === 0;
    });
    return cell;
  }

  function tdStyle() { return "padding:.5rem;border-top:1px solid var(--card-border);text-align:center"; }
  function thStyle() { return "padding:.5rem;border-bottom:1px solid var(--card-border);text-align:center;font-weight:600"; }
  function byId(id) { return document.getElementById(id); }

  // Get numeric from input/select/span (defensive)
  function numVal(node) {
    if (!node) return 0;
    const el = node.tagName ? node : null;
    const t = el?.tagName;
    let v = "0";
    if (t === "INPUT" || t === "SELECT") v = el.value ?? "0";
    else if (t === "SPAN") v = el.textContent ?? "0";
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }

  // Utility to build labeled selects with id/name convention
  function buildSelect(key, options, placeholder, disabled = false) {
    const sel = h("select", { className: "form-control", id: `fld-${key}`, name: key, disabled });
    setSelectOptions(sel, options, placeholder);
    return sel;
  }

  // --- dataset helpers for rows ---
  function getCellInput(type, tr, col) {
    const td = tr.querySelector(`[data-col="${col}"]`);
    return td ? td.querySelector(type) : null;
  }
  function getCell(typeOrTr, maybeTr, maybeCol) {
    // Overload for save: getCell("input", tr, "rrp") OR getCell(tr, "desc")
    if (typeof typeOrTr === "string") {
      return getCellInput(typeOrTr, maybeTr, maybeCol);
    } else {
      const tr = typeOrTr;
      const col = maybeTr; // when called as getCell(tr, "desc")
      return tr.querySelector(`[data-col="${col}"]`)?.querySelector("*") || tr.querySelector(`[data-col="${col}"]`);
    }
  }
}
