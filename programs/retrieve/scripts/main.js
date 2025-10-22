// Retrieve Programs — dynamic table + Excel-safe CSV export (no warning)

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
function fmtNum2(n) {             // SOLO para pintar en pantalla
  const x = Number(n);
  return Number.isFinite(x) ? x.toFixed(2) : "";
}
function rawNum(n) {               // PARA EXPORTAR: número crudo
  const x = Number(n);
  return Number.isFinite(x) ? x : "";   // deja vacío si no es número
}
function getPn(ln){                // PN robusto (pn o PN)
  return (ln && (ln.pn ?? ln.PN)) ?? "";
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
  document.querySelector("main.container")?.style.setProperty("max-width", "90vw");

  const mount        = document.getElementById("mount");
  const q            = document.getElementById("q");
  const btnRefresh   = document.getElementById("btnRefresh");
  const btnExportCSV = document.getElementById("btnExportCSV");

  let programs  = [];
  let customers = [];
  let currentFlatRows = []; // <- lo que se exporta (sin formato)

  // tabla
  const table = h("table", { className: "retrieve-table w-full", id: "tblPrograms" });
  const thead = h("thead");
  thead.append(h("tr", {}, ...COLS.map(c => h("th", {}, c))));
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
    currentFlatRows = [];

    for (const p of programs) {
      const customerName = customers.find(c => c.crmNumber === p.customer)?.customerName || p.customer;
      const lines = Array.isArray(p.lines) && p.lines.length ? p.lines : [ {} ];

      const filtered = lines.filter(ln => {
        const match = [
          p.programNumber, p.geo, p.country, p.vertical, customerName,
          getPn(ln), ln?.description
        ].join(" ").toLowerCase();
        return !term || match.includes(term);
      });
      if (filtered.length === 0) continue;

      const groupClass = (rows._toggle = !rows._toggle) ? "row-group-a" : "row-group-b";
      let first = true;

      for (const ln of filtered) {
        // 1) fila "cruda" (sin formato) para export
        const flatRaw = [
          p.programNumber || "",
          p.programType   || "",
          p.geo           || "",
          p.country       || "",
          p.vertical      || "",
          customerName    || "",
          fmtDate(p.startDay),                 // fechas como texto ISO (Excel las reconoce)
          fmtDate(p.endDay),
          getPn(ln),
          ln?.description ?? "",
          rawNum(ln?.rrp),
          rawNum(ln?.promoRrp),
          rawNum(ln?.rebate),
          rawNum(ln?.maxQty),
          rawNum(ln?.totalProgramRebate),
        ];
        currentFlatRows.push(flatRaw);

        // 2) fila con formato SOLO visual (números a 2 decimales)
        const visual = [
          flatRaw[0], flatRaw[1], flatRaw[2], flatRaw[3], flatRaw[4], flatRaw[5],
          flatRaw[6], flatRaw[7], flatRaw[8], flatRaw[9],
          fmtNum2(ln?.rrp), fmtNum2(ln?.promoRrp), fmtNum2(ln?.rebate),
          fmtNum2(ln?.maxQty), fmtNum2(ln?.totalProgramRebate)
        ];

        rows.push(h("tr", { className: `${groupClass} ${first ? "row-group-start" : ""}` },
          ...visual.map((val, idx) => h("td", { className: idx >= 10 ? "num" : "" }, val))
        ));
        first = false;
      }
    }

    if (rows.length === 0) {
      tbody.replaceChildren(h("tr", {}, h("td", { colSpan: COLS.length }, "No matching programs.")));
      return;
    }
    tbody.replaceChildren(...rows);
  }

  // -------- Export: CSV sin formato --------
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

    // separador coma; Excel lo abre sin warning
    const esc = (v) => {
      // deja números tal cual; texto escapado
      if (typeof v === "number") return String(v);
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines = [
      "\uFEFF" + COLS.join(","),                             // BOM + cabecera
      ...currentFlatRows.map(r => r.map(esc).join(","))      // filas sin formato
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `programs_${new Date().toISOString().slice(0,10)}.csv`);
  }

  // events
  q.addEventListener("input", renderRows);
  btnRefresh.addEventListener("click", load);
  btnExportCSV.addEventListener("click", exportCSV);

  await load();
}
