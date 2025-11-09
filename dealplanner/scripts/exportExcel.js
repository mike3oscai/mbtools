/* exportExcel.js
   Export .xlsx con fórmulas (una fila por producto) + fila de Totales en negrita.
*/
import { getState } from "./store.js";

async function loadXLSX() {
  return await import("https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs");
}

function num(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
function str(v){ return (v ?? "").toString(); }

export async function exportToXlsx() {
  const XLSX = await loadXLSX();

  const { customer, products } = getState();
  const ids = products.allIds;

  const headers = [
    "Customer Name","Front End %","Back End %","Distributor Fee %",
    "Program","RAM","ROM","Type",
    "RRP (€)","VAT (%)","RRP w/o VAT (€)",
    "Copy Levy (€)","DEEE (€)",
    "TMC ($)","X-Rate","TMC (€)",
    "Customer Invoice (€)","Distributor Invoice (€)","SOA per Box (€)","Triple Net (€)",
    "AUR ($)","GP (%)",
    "SOA Mode",
    "Promo RRP 1 (€)","Units Promo 1","SOA Promo 1 (€)","Total SOA Promo 1 (€)",
    "Promo RRP 2 (€)","Units Promo 2","SOA Promo 2 (€)","Total SOA Promo 2 (€)",
    "Total Units","Total SOA (€)",
    "Total Net Revenue ($)","Total Net Revenue (€)",
    "Total GP ($)","Total GP (€)"
  ];

  const aoa = [headers];

  const COL = {
    customerName:0, fe:1, be:2, df:3,
    program:4, ram:5, rom:6, type:7,
    rrp:8, vat:9, rrpNoVat:10,
    copyLevy:11, deee:12,
    tmcUsd:13, xrate:14, tmcEur:15,
    custInv:16, distInv:17, soaPerBox:18, tripleNet:19,
    aurUsd:20, gpPct:21,
    soaMode:22,
    promo1Rrp:23, promo1Units:24, promo1Soa:25, promo1TotalSoa:26,
    promo2Rrp:27, promo2Units:28, promo2Soa:29, promo2TotalSoa:30,
    totalUnits:31, totalSoa:32,
    totNetUsd:33, totNetEur:34,
    totGpUsd:35, totGpEur:36
  };

  // ---- Datos por producto (valores + placeholders para fórmulas)
  ids.forEach((id) => {
    const b = products.byId[id];
    const row = new Array(headers.length).fill("");

    row[COL.customerName] = customer.name || "";
    row[COL.fe]  = num(customer.frontEnd);
    row[COL.be]  = num(customer.backEnd);
    row[COL.df]  = num(customer.distributorFee);

    row[COL.program] = b.product.program || "";
    row[COL.ram]     = b.product.ram || "";
    row[COL.rom]     = b.product.rom || "";
    row[COL.type]    = b.product.type || "";

    row[COL.rrp]      = num(b.pricing.rrp);
    row[COL.vat]      = num(b.pricing.vatPct);
    row[COL.rrpNoVat] = null; // fórmula

    row[COL.copyLevy] = num(b.product.copyLevy);
    row[COL.deee]     = num(b.product.deee);

    row[COL.tmcUsd]   = num(b.product.tmcUsd);
    row[COL.xrate]    = num(b.product.xRate);
    row[COL.tmcEur]   = null; // fórmula

    row[COL.custInv]  = null; // fórmula
    row[COL.distInv]  = null; // fórmula
    row[COL.soaPerBox]= null; // fórmula
    row[COL.tripleNet]= null; // fórmula

    row[COL.aurUsd]   = null; // fórmula
    row[COL.gpPct]    = null; // fórmula

    row[COL.soaMode]  = str(b.promotions?.mode || "on_vat");

    row[COL.promo1Rrp]   = num(b.promotions.promo1Rrp);
    row[COL.promo1Units] = Math.trunc(num(b.promotions.promo1Units));
    row[COL.promo1Soa]   = null; // fórmula
    row[COL.promo1TotalSoa] = null; // fórmula

    row[COL.promo2Rrp]   = num(b.promotions.promo2Rrp);
    row[COL.promo2Units] = Math.trunc(num(b.promotions.promo2Units));
    row[COL.promo2Soa]   = null; // fórmula
    row[COL.promo2TotalSoa] = null; // fórmula

    row[COL.totalUnits]  = null; // fórmula
    row[COL.totalSoa]    = null; // fórmula

    row[COL.totNetUsd]   = null; // fórmula
    row[COL.totNetEur]   = null; // fórmula
    row[COL.totGpUsd]    = null; // fórmula
    row[COL.totGpEur]    = null; // fórmula

    aoa.push(row);
  });

  // ---- Worksheet y helpers
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const addr = (r1, c0) => XLSX.utils.encode_cell({ r: r1 - 1, c: c0 });
  const bold = { font: { bold: true } };

  // ---- Fórmulas por fila
  for (let i = 0; i < ids.length; i++) {
    const row = i + 2;                  // header en 1
    const R = (c) => addr(row, c);

    // RRP sin IVA
    ws[R(COL.rrpNoVat)] = { t:"n", f: `${R(COL.rrp)}/(1+${R(COL.vat)}/100)` };

    // TMC (€) = TMC ($) * X-Rate
    ws[R(COL.tmcEur)] = { t:"n", f: `${R(COL.tmcUsd)}*${R(COL.xrate)}` };

    // Customer & Distributor Invoice
    ws[R(COL.custInv)] = { t:"n", f: `(${R(COL.rrpNoVat)}-${R(COL.copyLevy)}-${R(COL.deee)})*(1-${R(COL.fe)}/100)` };
    ws[R(COL.distInv)] = { t:"n", f: `${R(COL.custInv)}*(1-${R(COL.df)}/100)` };

    // SOA Promo 1 y 2 condicionadas por modo
    ws[R(COL.promo1Soa)] = {
      t:"n",
      f: `IF(${R(COL.soaMode)}="on_vat_fe",( ${R(COL.rrp)}-${R(COL.promo1Rrp)} )/(1+${R(COL.vat)}/100)*(1-${R(COL.fe)}/100),( ${R(COL.rrp)}-${R(COL.promo1Rrp)} )/(1+${R(COL.vat)}/100))`
    };
    ws[R(COL.promo2Soa)] = {
      t:"n",
      f: `IF(${R(COL.soaMode)}="on_vat_fe",( ${R(COL.rrp)}-${R(COL.promo2Rrp)} )/(1+${R(COL.vat)}/100)*(1-${R(COL.fe)}/100),( ${R(COL.rrp)}-${R(COL.promo2Rrp)} )/(1+${R(COL.vat)}/100))`
    };

    // Totales promoción
    ws[R(COL.promo1TotalSoa)] = { t:"n", f: `${R(COL.promo1Units)}*${R(COL.promo1Soa)}` };
    ws[R(COL.promo2TotalSoa)] = { t:"n", f: `${R(COL.promo2Units)}*${R(COL.promo2Soa)}` };

    ws[R(COL.totalUnits)] = { t:"n", f: `${R(COL.promo1Units)}+${R(COL.promo2Units)}` };
    ws[R(COL.totalSoa)]   = { t:"n", f: `${R(COL.promo1TotalSoa)}+${R(COL.promo2TotalSoa)}` };

    // SOA por caja y Triple Net
    ws[R(COL.soaPerBox)] = { t:"n", f: `IF(${R(COL.totalUnits)}>0, ${R(COL.totalSoa)}/${R(COL.totalUnits)}, 0)` };
    ws[R(COL.tripleNet)] = { t:"n", f: `${R(COL.distInv)}-${R(COL.soaPerBox)}` };

    // AUR ($) y GP (%)
    ws[R(COL.aurUsd)] = { t:"n", f: `(${R(COL.tripleNet)}+${R(COL.copyLevy)}+${R(COL.deee)})/${R(COL.xrate)}` };
    ws[R(COL.gpPct)]   = { t:"n", f: `((${R(COL.tripleNet)}/${R(COL.xrate)})/${R(COL.tmcUsd)}-1)*100` };

    // Totales por producto
    ws[R(COL.totNetUsd)] = { t:"n", f: `${R(COL.totalUnits)}*${R(COL.aurUsd)}` };
    ws[R(COL.totNetEur)] = { t:"n", f: `${R(COL.totNetUsd)}*${R(COL.xrate)}` };
    ws[R(COL.totGpUsd)]  = { t:"n", f: `${R(COL.totalUnits)}*(${R(COL.aurUsd)}-${R(COL.tmcUsd)})` };
    ws[R(COL.totGpEur)]  = { t:"n", f: `${R(COL.totalUnits)}*((${R(COL.aurUsd)}*${R(COL.xrate)})-${R(COL.tmcEur)})` };
  }

  // ---- Fila de Totales (negrita)
  const firstDataRow = 2;
  const lastDataRow  = ids.length + 1;
  const totalsRow    = lastDataRow + 1;
  const Rtot = (c) => addr(totalsRow, c);
  const A1   = (r,c) => addr(r,c);

  ws[Rtot(COL.customerName)] = { t:"s", v: "TOTALS", s: bold };

  ws[Rtot(COL.promo1Units)]    = { t:"n", f: `SUM(${A1(firstDataRow, COL.promo1Units)}:${A1(lastDataRow, COL.promo1Units)})`, s: bold };
  ws[Rtot(COL.promo1TotalSoa)] = { t:"n", f: `SUM(${A1(firstDataRow, COL.promo1TotalSoa)}:${A1(lastDataRow, COL.promo1TotalSoa)})`, s: bold };
  ws[Rtot(COL.promo2Units)]    = { t:"n", f: `SUM(${A1(firstDataRow, COL.promo2Units)}:${A1(lastDataRow, COL.promo2Units)})`, s: bold };
  ws[Rtot(COL.promo2TotalSoa)] = { t:"n", f: `SUM(${A1(firstDataRow, COL.promo2TotalSoa)}:${A1(lastDataRow, COL.promo2TotalSoa)})`, s: bold };

  ws[Rtot(COL.totalUnits)] = { t:"n", f: `SUM(${A1(firstDataRow, COL.totalUnits)}:${A1(lastDataRow, COL.totalUnits)})`, s: bold };
  ws[Rtot(COL.totalSoa)]   = { t:"n", f: `SUM(${A1(firstDataRow, COL.totalSoa)}:${A1(lastDataRow, COL.totalSoa)})`, s: bold };
  ws[Rtot(COL.totNetUsd)]  = { t:"n", f: `SUM(${A1(firstDataRow, COL.totNetUsd)}:${A1(lastDataRow, COL.totNetUsd)})`, s: bold };
  ws[Rtot(COL.totNetEur)]  = { t:"n", f: `SUM(${A1(firstDataRow, COL.totNetEur)}:${A1(lastDataRow, COL.totNetEur)})`, s: bold };
  ws[Rtot(COL.totGpUsd)]   = { t:"n", f: `SUM(${A1(firstDataRow, COL.totGpUsd)}:${A1(lastDataRow, COL.totGpUsd)})`, s: bold };
  ws[Rtot(COL.totGpEur)]   = { t:"n", f: `SUM(${A1(firstDataRow, COL.totGpEur)}:${A1(lastDataRow, COL.totGpEur)})`, s: bold };

  // Total GP % (base coste): (Σ Units×TripleNet$ / Σ Units×TMC$) - 1
  const sumNum = `SUMPRODUCT(${A1(firstDataRow, COL.totalUnits)}:${A1(lastDataRow, COL.totalUnits)}, ${A1(firstDataRow, COL.tripleNet)}:${A1(lastDataRow, COL.tripleNet)} / ${A1(firstDataRow, COL.xrate)}:${A1(lastDataRow, COL.xrate)})`;
  const sumDen = `SUMPRODUCT(${A1(firstDataRow, COL.totalUnits)}:${A1(lastDataRow, COL.totalUnits)}, ${A1(firstDataRow, COL.tmcUsd)}:${A1(lastDataRow, COL.tmcUsd)})`;
  ws[Rtot(COL.gpPct)] = { t:"n", f: `IF(${sumDen}>0, (${sumNum}/${sumDen}-1)*100, 0)`, s: bold };

  // Aplicar negrita a toda la fila (por si añadimos columnas en el futuro)
  for (let c = 0; c < headers.length; c++) {
    const a = Rtot(c);
    ws[a] = ws[a] || { t:"s", v:"" };
    ws[a].s = Object.assign({}, ws[a].s || {}, bold);
  }

  // Anchos de columna para legibilidad
  ws["!cols"] = headers.map(() => ({ wch: 18 }));

  // --- Asegurar que la fila de totales entra en el rango de la hoja ---
  const curRef = ws["!ref"] || `A1:${addr(1, headers.length - 1)}`;
  const rng = XLSX.utils.decode_range(curRef);
  rng.e.r = Math.max(rng.e.r, totalsRow - 1);           // último row (0-based)
  rng.e.c = Math.max(rng.e.c, headers.length - 1);      // última columna
  ws["!ref"] = XLSX.utils.encode_range(rng);

  // Workbook y descarga
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "DealPlanner");

  const blob = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true });
  const url  = URL.createObjectURL(new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));

  const a = document.createElement("a");
  a.href = url;
  a.download = "dealplanner_export.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
