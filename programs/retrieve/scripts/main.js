// Retrieve Programs — dynamic table + native .xlsx export (no warnings)

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

  const mount         = document.getElementById("mount");
  const q             = document.getElementById("q");
  const btnRefresh    = document.getElementById("btnRefresh");
  const btnExportXLSX = document.getElementById("btnExportXLSX");

  let programs  = [];
  let customers = [];
  // filas planas actuales (para exportación)
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
        // 1) fila cruda para export (números sin formato)
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

  // ===== Export .xlsx (OpenXML) sin librerías =====

  // Texto → XML seguro
  function escXml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
  }

  // Mapea índice de columna (0-based) a coordenada Excel (A, B, ..., AA, AB...)
  function colLetter(idx) {
    let s = "";
    idx += 1;
    while (idx > 0) {
      const m = (idx - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      idx = Math.floor((idx - 1) / 26);
    }
    return s;
  }

  // Construye sheet1.xml con inline strings (no sharedStrings)
  function buildSheetXML() {
    let rowsXml = "";

    // Header
    rowsXml += `<row r="1">` + COLS.map((v, i) =>
      `<c r="${colLetter(i)}1" t="inlineStr"><is><t>${escXml(v)}</t></is></c>`
    ).join("") + `</row>`;

    // Data
    for (let r = 0; r < currentFlatRows.length; r++) {
      const rowIndex = r + 2; // empieza en 2
      const row = currentFlatRows[r];
      let cells = "";
      for (let c = 0; c < row.length; c++) {
        const coord = `${colLetter(c)}${rowIndex}`;
        const val = row[c];
        // columnas 10..14 (0-based) son numéricas
        if (c >= 10 && typeof val === "number") {
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

  // Archivos XML base del paquete XLSX (mínimos)
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

  // ====== ZIP writer (STORE, sin compresión) + CRC32 ======
  function strToU8(str) {
    return new TextEncoder().encode(str);
  }
  // CRC32
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

  function concat(chunks) {
    let len = chunks.reduce((a,c)=>a+c.length,0);
    let out = new Uint8Array(len);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }

  function fileHeader(nameU8, dataU8, crc, offset) {
    const LFH = [
      // Local file header signature
      u32(0x04034b50),
      u16(20),        // version needed
      u16(0),         // flags
      u16(0),         // method = store
      u16(0), u16(0), // time/date
      u32(crc),
      u32(dataU8.length),
      u32(dataU8.length),
      u16(nameU8.length),
      u16(0)          // extra len
    ];
    return concat([...LFH, nameU8, dataU8]);
  }

  function centralHeader(nameU8, dataU8, crc, lfhOff) {
    const CH = [
      u32(0x02014b50), // central file header signature
      u16(20), u16(20), // version made by / needed
      u16(0), u16(0),   // flags / method
      u16(0), u16(0),   // time/date
      u32(crc),
      u32(dataU8.length),
      u32(dataU8.length),
      u16(nameU8.length),
      u16(0), u16(0),   // extra/comment
      u16(0), u16(0),   // disk/start
      u32(0),           // external attrs
      u32(lfhOff)       // local header rel offset
    ];
    return concat([...CH, nameU8]);
  }

  function buildZip(files) {
    // files: [{name, data(Uint8Array)}]
    let offset = 0;
    const fileParts = [];
    const centralParts = [];

    for (const f of files) {
      const nameU8 = strToU8(f.name);
      const dataU8 = f.data;
      const crc = crc32(dataU8);

      const lfh = [
        u32(0x04034b50),
        u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(dataU8.length), u32(dataU8.length),
        u16(nameU8.length), u16(0)
      ];
      const lfhBin = concat([...lfh, nameU8, dataU8]);
      fileParts.push(lfhBin);

      const cfh = [
        u32(0x02014b50),
        u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(dataU8.length), u32(dataU8.length),
        u16(nameU8.length), u16(0), u16(0), u16(0), u16(0),
        u32(0), u32(offset)
      ];
      const cfhBin = concat([...cfh, nameU8]);
      centralParts.push(cfhBin);

      offset += lfhBin.length;
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

  await load();

  // ===== XML helpers (mantenidos aquí para cierre sobre currentFlatRows) =====
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
}
