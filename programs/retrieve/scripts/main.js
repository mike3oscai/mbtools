// Retrieve Programs — build the whole table dynamically (no table HTML in index)

function h(tag, props = {}, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  for (const c of children.flat()) el.append(c?.nodeType ? c : document.createTextNode(c ?? ""));
  return el;
}

const COLS = [
  "Program Number","Type","Geo","Country","Vertical","Customer",
  "Start","End","PN","Description","RRP","Promo RRP","Rebate","Max Qty","Total Program Rebate"
];

function fmtDate(d) {
  if (!d) return "";
  try { return new Date(d).toISOString().slice(0,10); } catch { return d; }
}
function fmtNum(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x.toFixed(2) : "";
}

async function fetchPrograms() {
  const res = await fetch("/api/programs?include=lines");
  if (!res.ok) throw new Error("Failed to load programs");
  const arr = await res.json();
  return Array.isArray(arr) ? arr : [];
}

async function loadCustomerSet() {
  const res = await fetch("/data/customerset.json", { cache: "no-store" });
  if (!res.ok) return [];
  return await res.json();
}

export async function renderRetrieve() {
  // ancho al 90% para esta página
  document.querySelector("main.container")?.style.setProperty("max-width", "90vw");

  const mount = document.getElementById("mount");
  const q = document.getElementById("q");
  const btnRefresh = document.getElementById("btnRefresh");

  let programs = [];
  let customers = [];

  // construye <table> + <thead> de una vez
  const table = h("table", { className: "w-full", id: "tblPrograms" });
  const thead = h("thead");
  const headRow = h("tr", {}, ...COLS.map(c => h("th", {}, c)));
  thead.append(headRow);
  const tbody = h("tbody", { id: "tbodyPrograms" });
  table.append(thead, tbody);
  mount.replaceChildren(table);

  async function load() {
    tbody.replaceChildren(h("tr", {}, h("td", { colSpan: COLS.length }, "Loading…")));
    try {
      [programs, customers] = await Promise.all([fetchPrograms(), loadCustomerSet()]);
      renderRows();
    } catch (e) {
      console.error(e);
      tbody.replaceChildren(h("tr", {}, h("td", { colSpan: COLS.length }, "Failed to load")));
    }
  }

  function renderRows() {
    const term = q.value.trim().toLowerCase();
    const rows = [];

    for (const p of programs) {
      const customerName = customers.find(c => c.crmNumber === p.customer)?.customerName || p.customer;
      const lines = Array.isArray(p.lines) && p.lines.length ? p.lines : [ {} ];

      for (const ln of lines) {
        const matchString = [
          p.programNumber, p.geo, p.country, p.vertical, customerName,
          ln.pn, ln.description
        ].join(" ").toLowerCase();
        if (term && !matchString.includes(term)) continue;

        rows.push(h("tr", {},
          h("td", {}, p.programNumber || ""),
          h("td", {}, p.programType || ""),
          h("td", {}, p.geo || ""),
          h("td", {}, p.country || ""),
          h("td", {}, p.vertical || ""),
          h("td", {}, customerName || ""),
          h("td", {}, fmtDate(p.startDay)),
          h("td", {}, fmtDate(p.endDay)),
          h("td", {}, ln.pn ?? ""),
          h("td", {}, ln.description ?? ""),
          h("td", { style: "text-align:right" }, fmtNum(ln.rrp)),
          h("td", { style: "text-align:right" }, fmtNum(ln.promoRrp)),
          h("td", { style: "text-align:right" }, fmtNum(ln.rebate)),
          h("td", { style: "text-align:right" }, fmtNum(ln.maxQty)),
          h("td", { style: "text-align:right" }, fmtNum(ln.totalProgramRebate))
        ));
      }
    }

    if (rows.length === 0) {
      tbody.replaceChildren(h("tr", {}, h("td", { colSpan: COLS.length }, "No matching programs.")));
      return;
    }

    tbody.replaceChildren(...rows);
  }

  // Wire events
  q.addEventListener("input", renderRows);
  btnRefresh.addEventListener("click", load);

  // go!
  await load();
}
