// Retrieve Programs — dynamic table + CSV/XLS export

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

  const mount        = document.getElementById("mount");
  const q            = document.getElementById("q");
  const btnRefresh   = document.getElementById("btnRefresh");
  const btnExportCSV = document.getElementById("btnExportCSV");
  const btnExportXLS = document.getElementById("btnExportXLS");

  let programs  = [];
  let customers = [];
  // cache de las filas planas actualmente mostradas (para exportación)
  let currentFlatRows = [];

  // construye <table> + <thead>
  const table = h("table", { className: "retrieve-table w-full", id: "tblPrograms" });
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
    currentFlatRows = []; // reset export cache

    for (const p of programs) {
      const customerName = customers.find(c => c.crmNumber === p.customer)?.customerName || p.customer;
      const lines = Array.isArray(p.lines) && p.lines.length ? p.lines : [ {} ];

      // prefiltra por término
      const preFiltered = lines.filter(ln => {
        const matchString = [
          p.programNumber, p.geo, p.country, p.vertical, customerName,
          ln?.pn, ln?.description
        ].join(" ").toLowerCase();
        return !term || matchString.includes(term);
      });
      if (preFiltered.length === 0) continue;

      // alterna color por programa
      const groupClass = (rows._toggle = !rows._toggle) ? "row-group-a" : "row-group-b";
      let firstOfGroup = true;

      for (const ln of preFiltered) {
        const flat = [
          p.programNumber || "",
          p.programType   || "",
          p.geo           || "",
          p.country       || "",
          p.vertical      || "",
          customerName    || "",
          fmtDate(p.startDay),
          fmtDate(p.endDay),
          ln?.pn ?? "",
          ln?.description ?? "",
          fmtNum(ln?.rrp),
          fmtNum(ln?.promoRrp),
          fmtNum(ln?.rebate),
          fmtNum(ln?.maxQty),
          fmtNum(ln?.totalProgramRebate),
        ];
        currentFlatRows.push(flat);

        rows.push(h("tr", { className: `${groupClass} ${firstOfGroup ? "row-group-start" : ""}` },
          ...flat.map((val, idx) => {
            const isNum = idx >= 10; // RRP en adelante
            return h("td", { className: isNum ? "num" : "" }, val);
          })
        ));
        firstOfGroup = false;
      }
    }

    if (rows.length === 0) {
      tbody.replaceChildren(h("tr", {}, h("td", { colSpan: COLS.length }, "No matching programs.")));
      return;
    }
    tbody.replaceChildren(...rows);
  }

  // ---------- Export helpers ----------
  function downloadBlob(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }

  function exportCSV() {
    if (!currentFlatRows.length) return alert("Nothing to export.");
    const esc = (v) => {
      const s = String(v ?? "");
      // envolver si contiene comillas, coma, salto de línea o punto y coma
      if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [
      "\uFEFF" + COLS.join(","), // BOM + cabecera
      ...currentFlatRows.map(r => r.map(esc).join(","))
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `programs_${new Date().toISOString().slice(0,10)}.csv`);
  }

  function exportExcel() {
    if (!currentFlatRows.length) return alert("Nothing to export.");
    // tabla HTML simple compatible con Excel
    const th = COLS.map(c => `<th>${escapeHtml(c)}</th>`).join("");
    const trs = currentFlatRows.map(r =>
      `<tr>${r.map((v,i) => `<td${i>=10?' style="mso-number-format:\'0.00\';text-align:right"':''}>${escapeHtml(v)}</td>`).join("")}</tr>`
    ).join("");
    const html =
      `<html><head><meta charset="UTF-8"></head><body>
         <table border="1"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>
       </body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    downloadBlob(blob, `programs_${new Date().toISOString().slice(0,10)}.xls`);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  // Wire events
  q.addEventListener("input", renderRows);
  btnRefresh.addEventListener("click", load);
  btnExportCSV.addEventListener("click", exportCSV);
  btnExportXLS.addEventListener("click", exportExcel);

  // go!
  await load();
}
