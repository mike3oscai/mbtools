/* exportExcel.js
   Export current simulation to a real .xlsx with live formulas (one row per product).
   Uses SheetJS (XLSX) via dynamic import.
*/
import { getState } from "./store.js";

async function loadXLSX() {
  return await import("https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs");
}

function num(v){ const n = Number(v); return Number.isFinite(n)? n : 0; }
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
    "SOA Mode",                                  // <<< NUEVA COLUMNA
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
    soaMode:22,                                      // <<< índice nuevo
    promo1Rrp:23, promo1Units:24, promo1Soa:25, promo1TotalSoa:26,
    promo2Rrp:27, promo2Units:28, promo2Soa:29, promo2TotalSoa:30,
    totalUnits:31, totalSoa:32,
    totNetUsd:33, totNetEur:34,
    totGpUsd:35, totGpEur:36
  };

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
    row[COL.rrpNoVat] = null; // formula

    row[COL.copyLevy] = num(b.product.copyLevy);
    row[COL.deee]     = num(b.product.deee);

    row[COL.tmcUsd]   = num(b.product.tmcUsd);
    row[COL.xrate]    = num(b.product.xRate);
    row[COL.tmcEur]   = null; // formula

    row[COL.custInv]  = null; // formula
    row[COL.distInv]  = null; // formula
    row[COL.soaPerBox]= null; // formula
    row[COL.tripleNet]= null; // formula

    row[COL.aurUsd]   = null; // formula
    row[COL.gpPct]    = null; // formula

    row[COL.soaMode]  = str(b.promotions?.mode || "on_vat");   // "on_vat" | "on_vat_fe"

    row[COL.promo1Rrp]   = num(b.promotions.promo1Rrp);
    row[COL.promo1Units] = Math.trunc(num(b.promotions.promo1Units));
    row[COL.promo1Soa]   = null; // formula
    row[COL.promo1TotalSoa] = null; // formula

    row[COL.promo2Rrp]   = num(b.promotions.promo2Rrp);
    row[COL.promo2Units] = Math.trunc(num(b.promotions.promo2Units));
    row[COL.promo2Soa]   = null; // formula
    row[COL.promo2TotalSoa] = null; // formula

    row[COL.totalUnits]  = null; // formula
    row[COL.totalSoa]    = null; // formula

    row[COL.totNetUsd]   = null; // formula
    row[COL.totNetEur]   = null; // formula
    row[COL.totGpUsd]    = null; // formula
    row[COL.totGpEur]    = null; // formula

    aoa.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const addr = (r1, c0) => XLSX.utils.encode_cell({ r: r1 - 1, c: c0 });

  for (let i = 0; i < ids.length; i++) {
    const row = i + 2;
    const R = (c) => addr(row, c);

    // RRP sin IVA
    ws[R(COL.rrpNoVat)] = { t:"n", f: `${R(COL.rrp)}/(1+${R(COL.vat)}/100)` };

    // TMC (€) = TMC ($) * X-Rate
    ws[R(COL.tmcEur)] = { t:"n", f: `${R(COL.tmcUsd)}*${R(COL.xrate)}` };

    // Customer Invoice = (RRPnoVAT - CopyLevy - DEEE) * (1 - FE%)
    ws[R(COL.custInv)] = { t:"n", f: `(${R(COL.rrpNoVat)}-${R(COL.copyLevy)}-${R(COL.deee)})*(1-${R(COL.fe)}/100)` };

    // Distributor Invoice = Customer Invoice * (1 - DF%)
    ws[R(COL.distInv)] = { t:"n", f: `${R(COL.custInv)}*(1-${R(COL.df)}/100)` };

    // SOA Promo 1 (€) — depende del modo
    // on_vat: (RRP - Promo1)/(1+VAT)
    // on_vat_fe: (RRP - Promo1)/(1+VAT) * (1-FE%)
    ws[R(COL.promo1Soa)] = {
      t:"n",
      f: `IF(${R(COL.soaMode)}="on_vat_fe", ( ${R(COL.rrp)} - ${R(COL.promo1Rrp)} )/(1+${R(COL.vat)}/100)*(1-${R(COL.fe)}/100), ( ${R(COL.rrp)} - ${R(COL.promo1Rrp)} )/(1+${R(COL.vat)}/100) )`
    };

    // SOA Promo 2 (€) — igual que arriba
    ws[R(COL.promo2Soa)] = {
      t:"n",
      f: `IF(${R(COL.soaMode)}="on_vat_fe", ( ${R(COL.rrp)} - ${R(COL.promo2Rrp)} )/(1+${R(COL.vat)}/100)*(1-${R(COL.fe)}/100), ( ${R(COL.rrp)} - ${R(COL.promo2Rrp)} )/(1+${R(COL.vat)}/100) )`
    };

    // Totales promo
    ws[R(COL.promo1TotalSoa)] = { t:"n", f: `${R(COL.promo1Units)}*${R(COL.promo1Soa)}` };
    ws[R(COL.promo2TotalSoa)] = { t:"n", f: `${R(COL.promo2Units)}*${R(COL.promo2Soa)}` };

    ws[R(COL.totalUnits)] = { t:"n", f: `${R(COL.promo1Units)}+${R(COL.promo2Units)}` };
    ws[R(COL.totalSoa)]   = { t:"n", f: `${R(COL.promo1TotalSoa)}+${R(COL.promo2TotalSoa)}` };

    // SOA per Box (€)
    ws[R(COL.soaPerBox)] = { t:"n", f: `IF(${R(COL.totalUnits)}>0, ${R(COL.totalSoa)}/${R(COL.totalUnits)}, 0)` };

    // Triple Net (€) = Distributor Invoice - SOA per Box
    ws[R(COL.tripleNet)] = { t:"n", f: `${R(COL.distInv)}-${R(COL.soaPerBox)}` };

    // AUR ($) = (Triple Net € + CopyLevy + DEEE) / X-Rate
    ws[R(COL.aurUsd)] = { t:"n", f: `(${R(COL.tripleNet)}+${R(COL.copyLevy)}+${R(COL.deee)})/${R(COL.xrate)}` };

    // GP (%) = ((Triple Net € / X-Rate) / TMC $ - 1) * 100
    ws[R(COL.gpPct)] = { t:"n", f: `((${R(COL.tripleNet)}/${R(COL.xrate)})/${R(COL.tmcUsd)}-1)*100` };

    // Totales por producto
    ws[R(COL.totNetUsd)] = { t:"n", f: `${R(COL.totalUnits)}*${R(COL.aurUsd)}` };
    ws[R(COL.totNetEur)] = { t:"n", f: `${R(COL.totNetUsd)}*${R(COL.xrate)}` };

    ws[R(COL.totGpUsd)]  = { t:"n", f: `${R(COL.totalUnits)}*(${R(COL.aurUsd)}-${R(COL.tmcUsd)})` };
    ws[R(COL.totGpEur)]  = { t:"n", f: `${R(COL.totalUnits)}*((${R(COL.aurUsd)}*${R(COL.xrate)})-${R(COL.tmcEur)})` };
  }

  ws["!cols"] = headers.map(() => ({ wch: 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "DealPlanner");

  const blob = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const url  = URL.createObjectURL(new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));

  const a = document.createElement("a");
  a.href = url;
  a.download = "dealplanner_export.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
