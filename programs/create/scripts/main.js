// Create a Program – header + products + table (ES module)

import { loadCustomerSet, loadProductSet, loadVatSet } from "/shared/scripts/data.js";
const GEOCOUNTRY_URL = "/data/geocountryset.json";

/* ---------- Opciones ---------- */
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

/* ---------- Helpers ---------- */
function h(tag, props = {}, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  for (const c of children.flat()) el.append(c?.nodeType ? c : document.createTextNode(c ?? ""));
  return el;
}
const unique = (arr) => [...new Set(arr)];
const fmtPN  = (p) => `${p.PN} — ${p.Description}`;
const byId   = (id) => document.getElementById(id);

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

// ¿Hay líneas en la tabla?
function hasLines() {
  return document.querySelectorAll(
    '#productsTbody tr[data-role="fields"], #productsTbody tr.prod-fields'
  ).length > 0;
}


// Devuelve true si hay líneas de producto en la tabla
function hasLines() {
  return document.querySelectorAll('#productsTbody tr[data-role="fields"], #productsTbody tr.prod-fields').length > 0;
}


/* ---------- Program number ---------- */
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

/* ---------- Countries loader ---------- */
async function loadCountriesByGeo(geo) {
  if (!geo) return [];
  try {
    const res = await fetch(GEOCOUNTRY_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load geocountryset.json");
    const data = await res.json();
    const entry = data.find(e => e.geo === geo);
    return entry ? entry.countries : [];
  } catch {
    return [];
  }
}

/* =================== UI principal =================== */
export async function renderCreateForm(container) {
  if (!container) return;

  // ----- Header controls -----
  const programTypeSel = buildSelect("programType", PROGRAM_TYPE_OPTIONS, "Select a program type");
  const geoSel         = buildSelect("geo", GEO_OPTIONS, "Select a geo");
  const countrySel     = buildSelect("country", [], "Select a country");
  const verticalSel    = buildSelect("vertical", VERTICAL_OPTIONS, "Select a vertical");

  const customerSel    = buildSelect("customer", [], "Select a customer (choose Geo first)", true);
  const startDayInp    = h("input", { className: "form-control", type: "date", id: "fld-startDay", name: "startDay" });
  const endDayInp      = h("input", { className: "form-control", type: "date", id: "fld-endDay", name: "endDay" });
  const programNumInp  = h("input", { className: "form-control", type: "text", id: "fld-programNumber", name: "programNumber", placeholder: "Auto after Confirm (editable)" });

  const activityInp = h("textarea", {
    className: "form-control",
    id: "fld-activity",
    name: "activity",
    rows: 3,
    placeholder: "Describe this activity..."
  });

  // === Grid (labels + controles) ===
  const grid = h("div", { className: "header-grid" });
  const L = (forId, text) => h("label", { className: "form-label", htmlFor: forId }, text);

  grid.append(
    L(programTypeSel.id, "Program Type"), programTypeSel,
    L(geoSel.id, "Geo"), geoSel,
    L(countrySel.id, "Country"), countrySel,
    L(verticalSel.id, "Vertical"), verticalSel,
    L(customerSel.id, "Customer"), customerSel,
    L(startDayInp.id, "Start Day"), startDayInp,
    L(endDayInp.id, "End Day"), endDayInp,
    L(activityInp.id, "Describe this activity:"), activityInp,
    L(programNumInp.id, "Program Number"), programNumInp
  );

  const actions = h("div", { className: "actions-row" },
    h("button", { id: "btnConfirm", className: "action-cta", type: "button" }, "Confirm"),
    h("button", { id: "btnDelete",  className: "action-cta", type: "button" }, "Delete")
  );

  container.replaceChildren(grid, actions);

  /* ---------- Sección Products ---------- */
  const productsSection = h("section", { id: "productsSection", className: "card", style: "display:none" },
    h("h2", {}, "Products"),
    h("div", { className: "form-row" },
      h("label", { className: "form-label", htmlFor: "fld-pn" }, "PN (multi-select)"),
      h("div", {},
        h("label", { style: "display:inline-flex;align-items:center;gap:.5rem;margin-bottom:.5rem" },
          h("input", { type: "checkbox", id: "chkSelectAll" }), "Select all"
        ),
        h("select", { id: "fld-pn", name: "pn", className: "form-control", multiple: true, size: 20 })
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
      h("div", {}, h("button", { id: "btnAddProducts", className: "action-cta", type: "button" }, "Add Products"))
    )
  );
  const mainContainer = container.closest("main") || container.parentElement;
  mainContainer.appendChild(productsSection);

  /* ---------- Tabla Selected products ---------- */
  const tableCard = h("section", { id: "selectedProductsCard", className: "card", style: "display:none" },
    h("h2", {}, "Selected products"),
    h("div", { className: "scroll" },
      h("table", { id: "productsTable" },
        h("thead", {}, trHead([
          "PN","Description","RRP","Promo RRP","Calculated RRP - VAT (Yes/No)","FE - Rebate",
          "Max Quantity","Total Program Rebate","Program Number","Actions"
        ])),
        h("tbody", { id: "productsTbody" })
      )
    ),
    h("div", { className: "actions-row" },
      h("button", { id: "btnSaveProgram", className: "action-cta", type: "button", disabled: true }, "Save Program")
    )
  );
  mainContainer.appendChild(tableCard);

  /* ---------- Refs & data ---------- */
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

  const [customers, products, vatset] = await Promise.all([
    loadCustomerSet(), loadProductSet(), loadVatSet()
  ]);

  const todayISO = new Date().toISOString().slice(0, 10);
  startDayInp.min = todayISO;

  const getVatForCountry = (country) => {
    const entry = vatset.find(v => v.country === country);
    return entry && typeof entry.vat === "number" ? entry.vat : null;
  };

  const parsePercentToDecimal = (v) => {
    if (v == null) return 0;
    if (typeof v === "string") {
      const s = v.trim().replace(",", ".").replace("%", "");
      const n = parseFloat(s);
      return Number.isFinite(n) ? (n / 100) : 0;
    }
    if (typeof v === "number") return v > 1 ? v / 100 : v;
    return 0;
  };
  const getFrontendForCustomer = (crmNumber) => {
    const c = customers.find(x => x.crmNumber === crmNumber);
    return parsePercentToDecimal(c?.frontend);
  };
  const formatPercent = (d) => `${(d * 100 || 0).toFixed(0)}%`;

  // Geo -> Countries + Customers
  geoSel.addEventListener("change", async () => {
    const countries = await loadCountriesByGeo(geoSel.value);
    setSelectOptions(countrySel, countries.map(c => ({ value: c, label: c })), "Select a country");
    refreshCustomers();
  });
  function refreshCustomers() {
    const g = geoSel.value, v = verticalSel.value;
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
  customerSel.addEventListener("change", () => recalcAllRows(tbody, countrySel));

  if (geoSel.value) {
    const countries = await loadCountriesByGeo(geoSel.value);
    setSelectOptions(countrySel, countries.map(c => ({ value: c, label: c })), "Select a country");
  }

  const setRamOptions = (list, selected = []) =>
    setSelectOptions(ramSel, unique(list.map(p => p.RAM)).map(v => ({ value: v, label: v })), "Choose RAM", selected);
  const setRomOptions = (list, selected = []) =>
    setSelectOptions(romSel, unique(list.map(p => p.ROM)).map(v => ({ value: v, label: v })), "Choose ROM", selected);
  const setPnOptions = (list, selected = []) => {
    const opts = list.map(p => ({ value: p.PN, label: fmtPN(p) }));
    pnSel.multiple = true; pnSel.size = 20;
    setSelectOptions(pnSel, opts, "Select PN(s) or filter by Product/RAM/ROM", selected);
  };
  const filteredProducts = () => {
    const selProduct = productSel.value, selRam = ramSel.value, selRom = romSel.value;
    return products.filter(p =>
      (!selProduct || p.Program === selProduct) &&
      (!selRam || p.RAM === selRam) &&
      (!selRom || p.ROM === selRom)
    );
  };

  chkSelectAll.addEventListener("change", () => {
    const list = filteredProducts();
    const values = chkSelectAll.checked ? list.map(p => p.PN) : [];
    setPnOptions(list, values);
  });

  pnSel.addEventListener("change", () => {
    const selectedPNs = Array.from(pnSel.selectedOptions).map(o => o.value);
    if (!selectedPNs.length) return;
    const selectedProducts = products.filter(p => selectedPNs.includes(p.PN));
    const progs = unique(selectedProducts.map(p => p.Program));
    const rams  = unique(selectedProducts.map(p => p.RAM));
    const roms  = unique(selectedProducts.map(p => p.ROM));
    if (progs.length === 1) productSel.value = progs[0];
    if (rams.length  === 1) ramSel.value = rams[0];
    if (roms.length  === 1) romSel.value = roms[0];
  });

  function onPRRChange() {
    const baseForOptions = productSel.value ? products.filter(p => p.Program === productSel.value) : products;
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

  (function initProductArea(){
    const programs = unique(products.map(p => p.Program)).map(v => ({ value: v, label: v }));
    setSelectOptions(productSel, programs, "Select a product");
    setRamOptions(products);
    setRomOptions(products);
    setPnOptions(products);
  })();

  /* ---------- Reset reutilizable ---------- */
  function resetProgramForm() {
    [programTypeSel, geoSel, countrySel, verticalSel, customerSel, startDayInp, endDayInp]
      .forEach(el => { el.disabled = false; el.value = ""; });
    programNumInp.value = "";
    activityInp.value   = "";
    refreshCustomers();

    productsSection.style.display = "";
    tableCard.style.display = "";
    btnSaveProgram.disabled = !hasLines();

    productSel.value = ""; ramSel.value = ""; romSel.value = "";
    chkSelectAll.checked = false;
    setRamOptions(products); setRomOptions(products); setPnOptions(products);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- Paso 1: Confirm / Delete ---------- */
  const today = todayISO;
  byId("btnConfirm").addEventListener("click", () => {
    const err = validateHeader();
    if (err) return alert(err);

    [programTypeSel, geoSel, countrySel, verticalSel, customerSel, startDayInp, endDayInp].forEach(el => el.disabled = true);

    if (!programNumInp.value.trim()) {
      programNumInp.value = buildProgramNumber(programTypeSel.value, geoSel.value, startDayInp.value);
    }

    productsSection.style.display = "";
    tableCard.style.display = "";
  });

  byId("btnDelete").addEventListener("click", resetProgramForm);

  function validateHeader() {
    if (!PROGRAM_TYPE_OPTIONS.some(o => o.value === programTypeSel.value)) return "Program Type is required.";
    if (!GEO_OPTIONS.some(o => o.value === geoSel.value)) return "Geo is required.";
    if (!countrySel.value) return "Country is required.";
    if (!VERTICAL_OPTIONS.some(o => o.value === verticalSel.value)) return "Vertical is required.";
    if (!customerSel.value) return "Customer is required.";
    const startISO = startDayInp.value;
    const endISO   = endDayInp.value;
    if (!startISO) return "Start Day is required.";
    if (startISO < today) return "Start Day must be today or in the future.";
    if (endISO && endISO < startISO) return "End Day cannot be earlier than Start Day.";
    return "";
  }

  /* ---------- Add Products + cálculo ---------- */
  btnAddProducts.addEventListener("click", () => {
    const selectedPNs = Array.from(pnSel.selectedOptions).map(o => o.value);
    const subset = selectedPNs.length ? products.filter(p => selectedPNs.includes(p.PN)) : filteredProducts();
    if (!subset.length) return alert("Please select at least one PN or narrow filters to a non-empty list.");

    const existing = new Set(Array.from(tbody.querySelectorAll("tr")).map(tr => tr.dataset.pn));
subset.forEach(p => {
  if (existing.has(p.PN)) return;

  const result = rowForProduct(p, programNumInp.value);
  // Soporta ambas firmas: {frag, trFields} o solo DocumentFragment
  const frag = result.frag || result;
  const trFields = result.trFields || [...frag.querySelectorAll('tr')].find(tr => tr.matches('[data-role="fields"], .prod-fields'));

  tbody.append(frag);

  if (trFields) recalcRow(trFields, countrySel);
  existing.add(p.PN);
});

// Habilita Save si hay líneas
btnSaveProgram.disabled = !hasLines();


  });

  /* ---------- SAVE PROGRAM (con fallback local) ---------- */
  btnSaveProgram.addEventListener("click", async () => {
    const header = {
      programType: programTypeSel.value,
      geo: geoSel.value,
      country: countrySel.value,
      vertical: verticalSel.value,
      customer: customerSel.value,
      startDay: startDayInp.value,
      endDay: endDayInp.value || null,
      programNumber: programNumInp.value,
      activity: activityInp.value.trim()
    };

    const fieldsRows = Array.from(tbody.querySelectorAll('tr[data-role="fields"]'));
    if (!fieldsRows.length) return alert("No products added.");

    const lines = fieldsRows.map(tr => ({
      pn: tr.dataset.pn || (getCell(tr, "pn")?.textContent ?? ""),
      description: getCell(tr, "desc")?.textContent ?? "",
      rrp: numVal(getCell("input", tr, "rrp")),
      promoRrp: numVal(getCell("input", tr, "promoRrp")),
      vatOnRrp: (getCell("select", tr, "vat")?.value) || "No",
      rebate: numVal(getCell("input", tr, "rebate")),
      maxQty: numVal(getCell("input", tr, "maxQty")),
      totalProgramRebate: numVal(getCell("span", tr, "total")),
      programNumber: (getCell("input", tr, "lineProgramNumber")?.value) || header.programNumber
    }));

    const body = {
      id: generateProgramId(header.programNumber, header.customer, header.startDay),
      createdAt: new Date().toISOString(),
      header,
      lines
    };

    // 1) Intento de guardar en tu API
    try {
      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const saved = await res.json();
        alert(`Program saved with id ${saved.id || body.id}`);
        resetProgramForm();
        return;
      }
      // si no ok, sigue al fallback
    } catch { /* continúa al fallback */ }

    // 2) Fallback: guardar como borrador local y ofrecer descarga
    try {
      const key = "programs:drafts";
      const drafts = JSON.parse(localStorage.getItem(key) || "[]");
      drafts.push(body);
      localStorage.setItem(key, JSON.stringify(drafts));
      // descarga
      const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${body.header.programNumber || "PROGRAM"}_${Date.now()}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);

      alert("Program saved locally (draft) and downloaded as JSON.");
      resetProgramForm();
    } catch {
      alert("Could not save program (network & local fallback failed).");
    }
  });

  /* ---------- Tabla helpers ---------- */
  function rowForProduct(p, programNumber) {
    // FILA 1: resumen (Remove ÚNICO)
    const trSummary = h("tr", {
      "data-pn": p.PN,
      "data-role": "summary",
      className: "prod-summary"
    },
      h("td", { colSpan: 2, className: "pn-cell" }, p.PN),
      h("td", { colSpan: 7, className: "desc-cell" }, p.Description),
      h("td", { className: "actions-cell" }, (() => {
        const btn = h("button", { type: "button", className: "action-cta sm" }, "Remove");
btn.addEventListener("click", () => {
  const pn = p.PN;
  tbody.querySelectorAll(`tr[data-pn="${pn}"]`).forEach(r => r.remove());
  btnSaveProgram.disabled = !hasLines();
});


        return btn;
      })())
    );

    // FILA 2: campos (sin Remove)
    const trFields = h("tr", {
      "data-pn": p.PN,
      "data-role": "fields",
      className: "prod-fields"
    },
      h("td", { colSpan: 2 }, ""),
      tdInputNumber("rrp", 0, onAnyChange),
      tdInputNumber("promoRrp", 0, onAnyChange),
      tdSelect("vat", ["Yes", "No"], "No", onAnyChange),
      tdRebateCell(onAnyChange),
      tdInputNumber("maxQty", 0, onAnyChange),
      tdReadOnly("total", "0.00"),
      tdInputText("lineProgramNumber", programNumber),
      h("td", {}, "")
    );

    function onAnyChange(){ recalcRow(trFields, countrySel); }

    const frag = document.createDocumentFragment();
    frag.append(trSummary, trFields);
    return { frag, trFields };
  }

  function recalcRow(tr, countrySelRef) {
    const rrpInput    = getCell("input", tr, "rrp");
    const promoInput  = getCell("input", tr, "promoRrp");
    const vatSelect   = getCell("select", tr, "vat");
    const rebateInput = getCell("input", tr, "rebate");
    const qtyInput    = getCell("input", tr, "maxQty");
    const totalSpan   = getCell("span", tr, "total");
    const rebateTd    = tr.querySelector('[data-col="rebate"]');
    const feBadge     = rebateTd ? rebateTd.querySelector('.fe-badge') : null;

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
        const vatDec = vatRate / 100;
        const rebate = (rrp - promo) / (1 + vatDec);
        rebateInput.value = rebate.toFixed(2);
        rebateInput.disabled = true;
      }
      if (feBadge) feBadge.style.display = "none";
    } else {
      const vatRate = getVatForCountry(countrySelRef?.value);
      const vatDec  = (vatRate && vatRate > 0) ? (vatRate / 100) : 0;
      const baseRRP   = vatDec > 0 ? (rrp / (1 + vatDec))   : rrp;
      const basePromo = vatDec > 0 ? (promo / (1 + vatDec)) : promo;

      const feDec = getFrontendForCustomer(customerSel.value);
      const factor = 1 - (feDec || 0);
      const rebate = (baseRRP * factor) - (basePromo * factor);
      rebateInput.value = (Number.isFinite(rebate) ? rebate : 0).toFixed(2);
      rebateInput.disabled = true;

      if (feBadge) {
        feBadge.textContent = `FE ${formatPercent(feDec)}`;
        feBadge.style.display = "inline-block";
      }
    }

    const rebateVal = parseFloat(rebateInput.value || "0") || 0;
    totalSpan.textContent = (rebateVal * qty).toFixed(2);
  }
  function recalcAllRows(tbodyEl, countrySelRef){
    Array.from(tbodyEl.querySelectorAll('tr[data-role="fields"]'))
         .forEach(tr => recalcRow(tr, countrySelRef));
  }

  function trHead(cols){ return h("tr", {}, ...cols.map(c => h("th", {}, c))); }
  function tdInputNumber(col, initial = 0, onInput){
    const inp = h("input", { type: "number", step: "0.01", value: initial, className: "form-control" });
    const cell = h("td", {}, inp); cell.dataset.col = col; if (onInput) inp.addEventListener("input", onInput); return cell;
  }
  function tdRebateCell(onInput){
    const fe = h("span", { className: "fe-badge", style: "display:none;margin-right:.5rem" }, "FE 0%");
    const inp = h("input", { type: "number", step: "0.01", value: 0, className: "form-control", style: "display:inline-block;width:auto" });
    const wrap = h("div", { style: "display:flex;align-items:center;justify-content:center;gap:.5rem" }, fe, inp);
    const cell = h("td", {}, wrap); cell.dataset.col = "rebate"; if (onInput) inp.addEventListener("input", onInput); return cell;
  }
  function tdInputText(col, val=""){ const inp = h("input", { type: "text", value: val, className: "form-control" }); const cell = h("td", {}, inp); cell.dataset.col = col; return cell; }
  function tdReadOnly(col, val=""){ const span = h("span", {}, val); const cell = h("td", {}, span); cell.dataset.col = col; return cell; }
  function tdSelect(col, opts, def, onChange){
    const sel = h("select", { className: "form-control" }, ...opts.map(o => h("option", { value: o, selected: o === def }, o)));
    if (onChange) sel.addEventListener("change", onChange);
    const cell = h("td", {}, sel); cell.dataset.col = col; return cell;
  }
  function getCell(typeOrTr, maybeTr, maybeCol){
    if (typeof typeOrTr === "string") {
      const td = maybeTr.querySelector(`[data-col="${maybeCol}"]`);
      return td ? td.querySelector(typeOrTr) : null;
    }
    const tr = typeOrTr, col = maybeTr;
    return tr.querySelector(`[data-col="${col}"]`)?.querySelector("*") || tr.querySelector(`[data-col="${col}"]`);
  }
  function numVal(node){
    if (!node) return 0;
    const t = node.tagName;
    const v = (t === "INPUT" || t === "SELECT") ? node.value : (t === "SPAN" ? node.textContent : "0");
    const n = parseFloat(v); return Number.isFinite(n) ? n : 0;
  }
  function buildSelect(key, options, placeholder, disabled = false){
    const sel = h("select", { className: "form-control", id: `fld-${key}`, name: key, disabled });
    setSelectOptions(sel, options, placeholder);
    return sel;
  }
  function generateProgramId(programNumber, customer, startDay) {
    const base = `${programNumber || "NONUM"}|${customer || "NOCUST"}|${startDay || ""}`;
    let h = 0; for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
    return `PRG-${h.toString(16).padStart(8, "0")}`;
  }
}

export function wireSelectedProducts() {}

// --- Sincroniza el estado del botón Save al cargar la página ---
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnSaveProgram');
  if (btn) btn.disabled = !hasLines();
});
