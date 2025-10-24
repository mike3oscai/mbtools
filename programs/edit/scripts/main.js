// /programs/edit/scripts/main.js
import { loadCustomerSet, loadProductSet, loadVatSet } from "/shared/scripts/data.js";

// …tu código de edición…

const COLS = [
  "Program Number","Type","Geo","Country","Vertical","Customer",
  "Start","End","PN","Description","RRP","Promo RRP","Rebate","Max Qty","Total Program Rebate",""
];
const IDX_MAXQTY = 13;

const $ = (s, r=document) => r.querySelector(s);
const h = (t, p={}, ...kids) => {
  const el = Object.assign(document.createElement(t), p);
  for (const k of kids.flat()) el.append(k?.nodeType ? k : document.createTextNode(k ?? ""));
  return el;
};

let programs = [];
let customers = [];

// state for dialog
let currentProgram = null;
let currentProgramLines = []; // original lines snapshot

/* ----------------------- Fetch & helpers ----------------------- */
async function fetchPrograms() {
  const res = await fetch("/api/programs?include=lines");
  if (!res.ok) throw new Error("Failed to load programs");
  return await res.json();
}
const fmtDate = d => d ? new Date(d).toISOString().slice(0,10) : "";
const money = n => {
  const x = Number(n);
  return Number.isFinite(x) ? x.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : "";
};
const intfmt = n => {
  const x = Number(n);
  return Number.isFinite(x) ? x.toLocaleString() : "";
};
const getCustomerName = crm => customers.find(c => c.crmNumber === crm)?.customerName || crm;

/* ----------------------- Render list ----------------------- */
function renderList() {
  const mount = $("#mount");
  const term = $("#q").value.trim().toLowerCase();

  const table = h("table", { className: "edit-table", id: "tblEdit" });
  const thead = h("thead");
  thead.append(h("tr", {},
    ...COLS.map((c, i) => h("th", { className: (i===COLS.length-1) ? "edit-col" : "" }, c))
  ));
  const tbody = h("tbody");

  for (const p of programs) {
    const custName = getCustomerName(p.customer);
    const lines = Array.isArray(p.lines) && p.lines.length ? p.lines : [ {} ];

    for (const ln of lines) {
      const hay = [
        p.programNumber, p.geo, p.country, p.vertical, custName, ln?.pn ?? ln?.PN, ln?.description
      ].join(" ").toLowerCase();
      if (term && !hay.includes(term)) continue;

      const row = [
        p.programNumber, p.programType, p.geo, p.country, p.vertical, custName,
        fmtDate(p.startDay), fmtDate(p.endDay),
        ln?.pn ?? ln?.PN ?? "", ln?.description ?? "",
        money(ln?.rrp), money(ln?.promoRrp), money(ln?.rebate),
        intfmt(ln?.maxQty), money(ln?.totalProgramRebate)
      ];

      const tr = h("tr", {},
        ...row.map((val, idx) => h("td", { className: idx>=10 ? "num" : "" }, val))
      );

      // pencil
      const tdEdit = h("td", { className: "edit-col" });
      const btn = h("button", { type:"button", className:"action-icon", title:"Edit quantities" }, "✏️");
      btn.addEventListener("click", () => openDialog(p));
      tdEdit.append(btn);
      tr.append(tdEdit);

      tbody.append(tr);
    }
  }

  if (!tbody.children.length) {
    tbody.append(h("tr", {}, h("td", { colSpan: COLS.length }, "No results.")));
  }

  table.append(thead, tbody);
  mount.replaceChildren(table);
}

/* ----------------------- Dialog ----------------------- */
function openDialog(program) {
  currentProgram = program;
  currentProgramLines = JSON.parse(JSON.stringify(program.lines || [])); // deep-ish clone

  // meta
  $("#metaProgramNumber").textContent = program.programNumber || "—";
  $("#metaType").textContent = program.programType || "—";
  $("#metaGeo").textContent = program.geo || "—";
  $("#metaCountry").textContent = program.country || "—";
  $("#metaVertical").textContent = program.vertical || "—";
  $("#metaCustomer").textContent = getCustomerName(program.customer) || "—";
  $("#metaStart").textContent = fmtDate(program.startDay);
  $("#metaEnd").textContent = fmtDate(program.endDay);

  // lines
  const tbody = $("#dlgLines tbody");
  tbody.replaceChildren();

  (program.lines || []).forEach((ln, idx) => {
    const currentMax = Number(ln.maxQty) || 0;
    const input = h("input", {
      type: "number",
      className: "form-control input-qty",
      min: 0,
      max: currentMax,
      step: 1,
      value: currentMax
    });
    input.addEventListener("input", () => {
      // Force only reductions (<= original)
      const orig = currentMax;
      let v = Number(input.value);
      if (!Number.isFinite(v) || v < 0) v = 0;
      if (v > orig) v = orig;            // never increase
      input.value = String(Math.floor(v));
    });

    const tr = h("tr", {},
      h("td", {}, ln?.pn ?? ln?.PN ?? ""),
      h("td", {}, ln?.description ?? ""),
      h("td", { className:"num" }, money(ln?.rrp)),
      h("td", { className:"num" }, money(ln?.promoRrp)),
      h("td", { className:"num" }, money(ln?.rebate)),
      h("td", { className:"num" }, money(ln?.totalProgramRebate)),
      h("td", { className:"num" }, intfmt(currentMax)),
      h("td", { className:"num" }, input)
    );
    // store a handle
    tr.dataset.index = idx;
    tbody.append(tr);
  });

  $("#dlgTitle").textContent = `Edit Program – ${program.programNumber}`;
  const dlg = $("#editDialog");
  dlg.showModal();

  $("#btnCancel").onclick = () => dlg.close();
  $("#editForm").onsubmit = async (ev) => {
    ev.preventDefault();
    await doSave();
  };
}

async function doSave() {
  if (!currentProgram) return;

  // read new maxQty values
  const rows = Array.from($("#dlgLines tbody").rows);
  const newLines = rows.map(tr => {
    const idx = Number(tr.dataset.index);
    const ln = currentProgram.lines[idx];
    const input = tr.querySelector("input");
    const newMax = Number(input.value);
    const orig = Number(ln.maxQty) || 0;
    // enforce decrease-only once more
    const safeMax = Math.max(0, Math.min(orig, Number.isFinite(newMax) ? newMax : orig));
    return { ...ln, maxQty: safeMax };
  });

  // build payload
  const payload = {
    id: currentProgram.id,
    createdAt: currentProgram.createdAt,
    header: {
      programNumber: currentProgram.programNumber,
      programType: currentProgram.programType,
      geo: currentProgram.geo,
      country: currentProgram.country,
      vertical: currentProgram.vertical,
      customer: currentProgram.customer,
      startDay: currentProgram.startDay,
      endDay: currentProgram.endDay || null,
      activity: currentProgram.activity ?? null
    },
    lines: newLines
  };

  // send PUT (overwrite)
  let res;
  try {
    res = await fetch(`/api/programs/${encodeURIComponent(currentProgram.id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    alert("Network error sending update");
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    alert(`Error updating program: ${err.error || res.statusText}`);
    return;
  }

  // optimistic update local state
  currentProgram.lines = newLines;
  $("#editDialog").close();

  // re-render list
  renderList();
}

/* ----------------------- Boot ----------------------- */
async function boot() {
  try {
    [programs, customers] = await Promise.all([fetchPrograms(), loadCustomerSet()]);
  } catch (e) {
    console.error(e);
    programs = [];
    customers = [];
  }
  renderList();

  $("#q").addEventListener("input", renderList);
  $("#btnRefresh").addEventListener("click", async () => {
    programs = await fetchPrograms();
    renderList();
  });
}

boot();
