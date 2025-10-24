// Retrieve Programs — KPIs + subtotales + pie sticky + export .xlsx nativo (+ Activity + icono info)

function h(tag, props = {}, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  for (const c of children.flat()) el.append(c?.nodeType ? c : document.createTextNode(c ?? ""));
  return el;
}

// Cabeceras UI (tabla visible) -> 15 columnas + 1 para icono
const COLS_UI = [
  "Program Number","Type","Geo","Country","Vertical","Customer",
  "Start","End","PN","Description","RRP","Promo RRP","Rebate","Max Qty","Total Program Rebate",""
];

// Cabeceras para EXCEL -> las 15 + Activity
const COLS_EXPORT = [
  "Program Number","Type","Geo","Country","Vertical","Customer",
  "Start","End","PN","Description","RRP","Promo RRP","Rebate","Max Qty","Total Program Rebate","Activity"
];

// índices útiles (no cambian porque Activity va al final)
const IDX_PN       = 8;
const IDX_DESC     = 9;
const IDX_RRP      = 10;
const IDX_PROMO    = 11;
const IDX_REBATE   = 12;
const IDX_MAXQTY   = 13;
const IDX_TOTAL    = 14;

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

function nfmtInt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString();
}
function nfmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function nfmtAvg(total, qty) {
  const t = Number(total), q = Number(qty);
  if (!(Number.isFinite(t) && Number.isFinite(q) && q > 0)) return "—";
  return (t / q).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  const mount         = document.getElementById("mount");
  const q             = document.getElementById("q");
  const btnRefresh    = document.getElementById("btnRefresh");
  const btnExportXLSX = document.getElementById("btnExportXLSX");

  // KPIs refs
  const kpiQty   = document.getElementById("kpiQty");
  const kpiTotal = document.getElementById("kpiTotal");
  const kpiAvg   = document.getElementById("kpiAvg");
  // Sticky refs
  const totLines = document.getElementById("totLines");
  const totQty   = document.getElementById("totQty");
  const totTotal = document.getElementById("totTotal");
  const totAvg   = document.getElementById("totAvg");

  let programs  = [];
  let customers = [];
  // filas planas actuales (para exportación y totales)
  let currentFlatRows = [];

  // Construir tabla base
  const table = h("table", { className: "retrieve-table w-full", id: "tblPrograms" });
  const thead = h("thead");
  thead.append(h("tr", {}, ...COLS_UI.map(c => h("th", {}, c))));
  const tbody = h("tbody", { id: "tbodyPrograms" });
  table.append(thead, tbody);
  mount.replaceChildren(table);

  async function load() {
    tbody.replaceChildren(h("tr", {}, h("td", { colSpan: COLS_UI.length }, "Loading…")));
    try {
      [programs, customers] = await Promise.all([fetchPrograms(), loadCustomerSet()]);
      renderRows();
    } catch (e) {
      console.error(e);
      tbody.replaceChildren(h("tr", {}, h("td", { colSpan: COLS_UI.length }, "Failed to load")));
      updateKpisAndFooter({ qty: 0, total: 0, avg: NaN, count: 0 });
    }
  }

  function computeTotals(rows) {
    let qty = 0, total = 0;
    let count = 0;
    for (const r of rows) {
      const qv = Number(r[IDX_MAXQTY]);
      const tv = Number(r[IDX_TOTAL]);
      if (Number.isFinite(qv)) qty += qv;
      if (Number.isFinite(tv)) total += tv;
      count++;
    }
    return { qty, total, avg: qty > 0 ? (total / qty) : NaN, count };
  }

  function renderRows() {
    const term = q.value.trim().toLowerCase();
    const rows = [];
    currentFlatRows = [];

    // agrupación por programa para poder añadir subtotales
    for (const p of programs) {
      const customerName =
        customers.find(c => c.crmNumber === p.customer)?.customerName ||
        p.customer;

      const lines = Array.isArray(p.lines) && p.lines.length ? p.lines : [ {} ];

      const activity =
        (p.activity ?? p.header?.activity ?? "").toString().trim();

      const filtered = lines.filter(ln => {
        const match = [
          p.programNumber, p.geo, p.country, p.vertical, customerName,
          getPn(ln), ln?.description, activity
        ].join(" ").toLowerCase();
        return !term || match.includes(term);
      });
      if (filtered.length === 0) continue;

      const groupClass = (rows._toggle = !rows._toggle) ? "row-group-a" : "row-group-b";
      let first = true;

      // acumuladores de subtotales
      let gQty = 0, gTotal = 0;

      for (const ln of filtered) {
        // 1) fila cruda para export/totales (añadimos Activity al final)
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
          activity
        ];
        currentFlatRows.push(flatRaw);

        // acumula subtotales (sobre los valores numéricos)
        if (Number.isFinite(flatRaw[IDX_MAXQTY])) gQty += flatRaw[IDX_MAXQTY];
        if (Number.isFinite(flatRaw[IDX_TOTAL]))  gTotal += flatRaw[IDX_TOTAL];

        // 2) fila visual (15 columnas) + icono tooltip (columna 16)
        const visual = [
          flatRaw[0], flatRaw[1], flatRaw[2], flatRaw[3], flatRaw[4], flatRaw[5],
          flatRaw[6], flatRaw[7], flatRaw[8], flatRaw[9],
          fmtNum2(ln?.rrp), fmtNum2(ln?.promoRrp), fmtNum2(ln?.rebate),
          fmtNum2(ln?.maxQty), fmtNum2(ln?.totalProgramRebate)
        ];

        const tr = h("tr", { className: `${groupClass} ${first ? "row-group-start" : ""}` },
          ...visual.map((val, idx) => h("td", { className: idx >= 10 ? "num" : "" }, val))
        );

        // celda del icono info
        // celda del icono info
const tdInfo = document.createElement("td");
if (activity) {
  const dot = document.createElement("span");
  dot.className = "info-dot";
  dot.textContent = "i";
  // IMPORTANTE: sin title para que no aparezca el tooltip nativo
  dot.setAttribute("data-tip", activity); // nuestro tooltip CSS
  tdInfo.append(dot);
} else {
  tdInfo.textContent = "";
}
tr.append(tdInfo);


        rows.push(tr);
        first = false;
      }

      // 3) subtotal de programa (fila al cierre del grupo)
      const subtotalTds = [];
      for (let i = 0; i < COLS_UI.length; i++) {
        if (i === IDX_MAXQTY) {
          subtotalTds.push(h("td", { className: "num" }, nfmtInt(gQty)));
        } else if (i === IDX_TOTAL) {
          subtotalTds.push(h("td", { className: "num" }, nfmtMoney(gTotal)));
        } else if (i === IDX_REBATE) {
          subtotalTds.push(h("td", { className: "num" }, nfmtAvg(gTotal, gQty)));
        } else if (i === 0) {
          subtotalTds.push(h("td", { className: "subtotal-label" }, "Subtotal"));
        } else if (i === COLS_UI.length - 1) {
          // columna del icono en el subtotal (vacía)
          subtotalTds.push(h("td", {}, ""));
        } else {
          subtotalTds.push(h("td", {}, ""));
        }
      }
      rows.push(h("tr", { className: `subtotal ${groupClass}` }, ...subtotalTds));
    }

    if (rows.length === 0) {
      tbody.replaceChildren(h("tr", {}, h("td", { colSpan: COLS_UI.length }, "No matching programs.")));
      updateKpisAndFooter({ qty: 0, total: 0, avg: NaN, count: 0 });
      return;
    }

    tbody.replaceChildren(...rows);

    // Totales globales (sobre dataset filtrado)
    const totals = computeTotals(currentFlatRows);
    updateKpisAndFooter(totals);
  }

  function updateKpisAndFooter({ qty, total, avg, count }) {
    // KPIs (arriba)
    kpiQty.textContent   = nfmtInt(qty);
    kpiTotal.textContent = nfmtMoney(total);
    kpiAvg.textContent   = nfmtAvg(total, qty);

    // Pie sticky
    totLines.textContent = count.toLocaleString();
    totQty.textContent   = nfmtInt(qty);
    totTotal.textContent = nfmtMoney(total);
    totAvg.textContent   = nfmtAvg(total, qty);
  }

  // ===== Export .xlsx (OpenXML) nativo sin librerías =====

  function escXml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
  }
  function colLetter(idx) { // 0->A, 25->Z, 26->AA...
    let s = ""; idx += 1;
    while (idx > 0) { const m = (idx - 1) % 26; s = String.fromCharCode(65 + m) + s; idx = Math.floor((idx - 1) / 26); }
    return s;
  }

  function buildSheetXML() {
    let rowsXml = "";
    // cabeceras de export (con Activity)
    rowsXml += `<row r="1">` + COLS_EXPORT.map((v, i) =>
      `<c r="${colLetter(i)}1" t="inlineStr"><is><t>${escXml(v)}</t></is></c>`
    ).join("") + `</row>`;

    // datos
    for (let r = 0; r < currentFlatRows.length; r++) {
      const rowIndex = r + 2;
      const row = currentFlatRows[r]; // incluye "Activity" en última columna
      let cells = "";
      for (let c = 0; c < row.length; c++) {
        const coord = `${colLetter(c)}${rowIndex}`;
        const val = row[c];
        if (c >= IDX_RRP && typeof val === "number") {
          cells += `<c r="${coord}"><v>${val}</v></c>`;
        } else {
          cells += `<c r="${coord}" t="inlineStr"><is><t>${escXml(val)}</t></is></c>`;
        }
      }
      rowsXml += `<row r="${rowIndex}">${cells}</row>`;
    }

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowsXml}</sheetData>
</worksheet>`;
  }

  function contentTypesXml() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;
  }
  function relsRels() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  }
  function workbookXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Programs" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
  }
  function workbookRels() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;
  }

  // ZIP writer (STORE) + CRC32
  function strToU8(str) { return new TextEncoder().encode(str); }
  const CRC_TABLE = (() => {
    let t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    let c = 0 ^ (-1);
    for (let i = 0; i < u8.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ u8[i]) & 0xFF];
    return (c ^ (-1)) >>> 0;
  }
  function u32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; }
  function u16(n) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; }
  function concat(chunks) { let len = chunks.reduce((a,c)=>a+c.length,0), out=new Uint8Array(len), o=0; for(const c of chunks){out.set(c,o);o+=c.length;} return out; }

  function buildZip(files) {
    let offset = 0;
    const fileParts = [], centralParts = [];

    for (const f of files) {
      const nameU8 = strToU8(f.name);
      const dataU8 = f.data;
      const crc = crc32(dataU8);

      const lfh = concat([
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(dataU8.length), u32(dataU8.length),
        u16(nameU8.length), u16(0), nameU8, dataU8
      ]);
      fileParts.push(lfh);

      const cfh = concat([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(dataU8.length), u32(dataU8.length),
        u16(nameU8.length), u16(0), u16(0), u16(0), u16(0),
        u32(0), u32(offset), nameU8
      ]);
      centralParts.push(cfh);

      offset += lfh.length;
    }

    const centralOffset = offset;
    const central = concat(centralParts);
    const end = concat([
      u32(0x06054b50),
      u16(0), u16(0),
      u16(files.length), u16(files.length),
      u32(central.length),
      u32(centralOffset),
      u16(0)
    ]);

    return new Blob([concat([...fileParts, central, end])], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
  }

  function exportXLSX() {
    if (!currentFlatRows.length) return alert("Nothing to export.");

    const files = [
      { name: "[Content_Types].xml", data: strToU8(contentTypesXml()) },
      { name: "_rels/.rels",         data: strToU8(relsRels()) },
      { name: "xl/workbook.xml",     data: strToU8(workbookXml()) },
      { name: "xl/_rels/workbook.xml.rels", data: strToU8(workbookRels()) },
      { name: "xl/worksheets/sheet1.xml",   data: strToU8(buildSheetXML()) }
    ];
    const zipBlob = buildZip(files);

    const a = document.createElement("a");
    a.href = URL.createObjectURL(zipBlob);
    a.download = `programs_${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  // Eventos
  q.addEventListener("input", renderRows);
  btnRefresh.addEventListener("click", load);
  btnExportXLSX.addEventListener("click", exportXLSX);

  // go!
  await load();
}
