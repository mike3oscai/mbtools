// Retrieve Programs — dynamic table + Excel (SpreadsheetML XML) export

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
function fmtNum2(n) {             // SOLO para la vista (2 decimales)
  const x = Number(n);
  return Number.isFinite(x) ? x.toFixed(2) : "";
}
function rawNum(n) {               // PARA EXPORTAR: número crudo
  const x = Number(n);
  return Number.isFinite(x) ? x : "";
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
  const btnExportXLS = document.getElementById("btnExportXLS");

  let programs  = [];
  let customers = [];
  // Cache de filas planas actuales (para export)
  let currentFlatRows = [];

  // Construir tabla
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
        // 1) fila cruda p/export
        const flatRaw = [
          p.programNumber || "",
          p.programType   || "",
          p.geo           || "",
          p.country       || "",
          p.vertical      || "",
          customerName    || "",
          fmtDate(p.startDay),
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

        // 2) fila visual (números bonitos)
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

  // ----- Export: Excel 2003 XML (SpreadsheetML, sin avisos y con números sumables) -----
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

  function escapeXml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  // Índices de columnas numéricas (RRP..Total)
  const NUM_COL_START = 10; // 0-based: columnas 10..14

  function exportExcelXML() {
    if (!currentFlatRows.length) return alert("Nothing to export.");

    // Cabecera
    const headerRowXml = `<Row>` + COLS.map(c =>
      `<Cell><Data ss:Type="String">${escapeXml(c)}</Data></Cell>`
    ).join("") + `</Row>`;

    // Filas
    const bodyRowsXml = currentFlatRows.map(r => {
      const cells = r.map((v, i) => {
        if (i >= NUM_COL_START && typeof v === "number") {
          // Número puro
          return `<Cell><Data ss:Type="Number">${v}</Data></Cell>`;
        }
        // Texto (fechas, PN, description, etc.)
        return `<Cell><Data ss:Type="String">${escapeXml(v)}</Data></Cell>`;
      }).join("");
      return `<Row>${cells}</Row>`;
    }).join("");

    const worksheetXml =
`<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:html="http://www.w3.org/TR/REC-html40">
  <Worksheet ss:Name="Programs">
    <Table>
      ${headerRowXml}
      ${bodyRowsXml}
    </Table>
  </Worksheet>
</Workbook>`;

    const blob = new Blob([worksheetXml], { type: "application/vnd.ms-excel;charset=utf-8" });
    const fname = `programs_${new Date().toISOString().slice(0,10)}.xml`; // Excel lo abre directo
    downloadBlob(blob, fname);
  }

  // events
  q.addEventListener("input", renderRows);
  btnRefresh.addEventListener("click", load);
  btnExportXLS.addEventListener("click", exportExcelXML);

  await load();
}
