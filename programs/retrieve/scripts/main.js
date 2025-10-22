// Retrieve Programs - flat view (each line = program + line info)

function h(tag, props = {}, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  for (const c of children.flat()) el.append(c?.nodeType ? c : document.createTextNode(c ?? ""));
  return el;
}

function fmtDate(d) {
  if (!d) return "";
  try { return new Date(d).toISOString().slice(0,10); } catch { return d; }
}
function fmtNum(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x.toFixed(2) : "";
}

// Preferimos el endpoint con include=lines
async function fetchPrograms() {
  const res = await fetch("/api/programs?include=lines");
  if (!res.ok) throw new Error("Failed to load programs");
  const arr = await res.json();
  return Array.isArray(arr) ? arr : [];
}

// Carga customer set (para traducir crm → nombre)
async function loadCustomerSet() {
  const res = await fetch("/data/customerset.json", { cache: "no-store" });
  if (!res.ok) return [];
  return await res.json();
}

export async function renderRetrieve() {
  const tbody = document.getElementById("tbodyPrograms");
  const q = document.getElementById("q");
  const btnRefresh = document.getElementById("btnRefresh");

  let data = [];
  let customers = [];

  async function load() {
    tbody.replaceChildren(h("tr", {}, h("td", { colSpan: 12 }, "Loading…")));
    try {
      [data, customers] = await Promise.all([fetchPrograms(), loadCustomerSet()]);
      renderTable();
    } catch (e) {
      console.error(e);
      tbody.replaceChildren(h("tr", {}, h("td", { colSpan: 12 }, "Failed to load.")));
    }
  }

  function renderTable() {
    const term = q.value.trim().toLowerCase();
    const rows = [];

    // Expand header + lines: una fila por cada PN
    for (const p of data) {
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
      tbody.replaceChildren(h("tr", {}, h("td", { colSpan: 15 }, "No matching programs.")));
      return;
    }

    tbody.replaceChildren(...rows);
  }

  // Filtros
  q.addEventListener("input", renderTable);
  btnRefresh.addEventListener("click", load);

  // Ancho al 90%
  document.querySelector("main.container")?.style.setProperty("max-width", "90vw");

  // go!
  await load();
}
