// /programs/edit/scripts/main.js
import { loadCustomerSet } from "/shared/scripts/data.js"; // reutilizamos shared

function h(tag, props = {}, ...kids) {
  const el = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) el.append(k?.nodeType ? k : document.createTextNode(k ?? ""));
  return el;
}

// ---- Construcción UI (toolbar + tabla) ----
const app = document.getElementById("app");

// Toolbar
const q = h("input", {
  id: "q",
  className: "inp",
  type: "search",
  placeholder: "Search program/customer/PN…",
});
const btnRefresh = h("button", { id: "btnRefresh", className: "btn" }, "Refresh");
const toolbar = h("div", { className: "toolbar" }, q, btnRefresh);

// Tabla
const table = h("table", { className: "edit-table", id: "tblEdit" });
const thead = h(
  "thead",
  {},
  h(
    "tr",
    {},
    ...[
      "Program Number",
      "Type",
      "Geo",
      "Country",
      "Vertical",
      "Customer",
      "Start",
      "End",
      "PN",
      "Description",
      "RRP",
      "Promo RRP",
      "Rebate",
      "Max Qty",
      "Total Program Rebate",
      "" // columna icono lápiz
    ].map((c) => h("th", {}, c))
  )
);
const tbody = h("tbody", { id: "tbodyEdit" });
table.append(thead, tbody);

// Montaje
app.replaceChildren(
  h("h1", { className: "title" }, "Edit Programs"),
  h("p", { className: "subtitle" }, "Find a program and reduce its quantities. Increasing is not allowed."),
  toolbar,
  table
);

// ---- Datos y render ----
let programs = [];
let customers = [];

async function fetchPrograms() {
  const res = await fetch("/api/programs?include=lines");
  if (!res.ok) throw new Error("Failed to load programs");
  return await res.json();
}

function fmtDate(d) {
  if (!d) return "";
  try { return new Date(d).toISOString().slice(0,10); } catch { return d; }
}
function n2(v) { const x = Number(v); return Number.isFinite(x) ? x.toFixed(2) : ""; }

function renderList() {
  const term = (q?.value || "").trim().toLowerCase();
  const rows = [];

  for (const p of programs) {
    const custName = customers.find(c => c.crmNumber === p.customer)?.customerName || p.customer;
    const lines = Array.isArray(p.lines) && p.lines.length ? p.lines : [ {} ];

    const filtered = lines.filter(ln => {
      const pn = (ln.pn ?? ln.PN ?? "");
      const txt = [
        p.programNumber, p.programType, p.geo, p.country, p.vertical, custName,
        pn, ln?.description
      ].join(" ").toLowerCase();
      return !term || txt.includes(term);
    });
    if (filtered.length === 0) continue;

    for (const ln of filtered) {
      const tr = h("tr", {},
        h("td", {}, p.programNumber || ""),
        h("td", {}, p.programType || ""),
        h("td", {}, p.geo || ""),
        h("td", {}, p.country || ""),
        h("td", {}, p.vertical || ""),
        h("td", {}, custName || ""),
        h("td", {}, fmtDate(p.startDay)),
        h("td", {}, fmtDate(p.endDay)),
        h("td", {}, ln?.pn ?? ln?.PN ?? ""),
        h("td", {}, ln?.description ?? ""),
        h("td", { className: "num" }, n2(ln?.rrp)),
        h("td", { className: "num" }, n2(ln?.promoRrp)),
        h("td", { className: "num" }, n2(ln?.rebate)),
        h("td", { className: "num" }, n2(ln?.maxQty)),
        h("td", { className: "num" }, n2(ln?.totalProgramRebate)),
        // Icono lápiz → abre modal
        h("td", { className: "center" },
          h("button", {
            className: "icon-btn",
            title: "Edit (reduce Max Qty)",
            onclick: () => openEditModal(p, ln)
          }, "✏️")
        )
      );
      rows.push(tr);
    }
  }

  if (!rows.length) {
    tbody.replaceChildren(h("tr", {}, h("td", { colSpan: 16, className: "muted" }, "No matching programs.")));
  } else {
    tbody.replaceChildren(...rows);
  }
}

// ---- Modal edición (solo bajar cantidades) ----
let modalEl; // singleton
function openEditModal(program, line) {
  if (!modalEl) {
    modalEl = h("dialog", { className: "modal" });
    document.body.appendChild(modalEl);
  }
  const current = Number(line?.maxQty || 0);
  const info = h("div", { className: "modal-info" },
    h("div", {}, h("strong", {}, "Program: "), program.programNumber || ""),
    h("div", {}, h("strong", {}, "PN: "), (line?.pn ?? line?.PN ?? "")),
    h("div", {}, h("strong", {}, "Description: "), line?.description ?? "")
  );
  const qtyInput = h("input", {
    type: "number",
    className: "inp",
    min: 0,
    max: current,
    step: "1",
    value: String(current),
  });
  const warn = h("div", { className: "muted" }, "You can only reduce quantities (≤ current).");
  const btnCancel = h("button", { className: "btn" }, "Cancel");
  const btnSave   = h("button", { className: "btn primary" }, "Save");

  btnCancel.onclick = () => modalEl.close();
  btnSave.onclick = async () => {
    const v = Number(qtyInput.value);
    if (!Number.isFinite(v) || v < 0 || v > current) {
      alert(`Quantity must be a number between 0 and ${current}.`);
      return;
    }
    try {
      // Construye el set de líneas con la cantidad actualizada (solo esa línea)
      const updatedLine = { ...line, maxQty: v };
      const lines = (program.lines || []).map(ln => {
        const same = (ln.pn ?? ln.PN) === (updatedLine.pn ?? updatedLine.PN);
        const src = same ? updatedLine : ln;
        return {
          pn: src.pn ?? src.PN ?? "",
          description: src.description ?? "",
          rrp: Number(src.rrp) || 0,
          promoRrp: Number(src.promoRrp) || 0,
          vatOnRrp: src.vatOnRrp ?? "No",
          rebate: Number(src.rebate) || 0,
          maxQty: Number(src.maxQty) || 0,
          totalProgramRebate: Number(src.totalProgramRebate) || 0,
          programNumber: src.lineProgramNumber ?? program.programNumber
        };
      });

      // Guarda (modo update) — el backend valida que no aumentes maxQty
      await saveChanges(program.id, lines);

      // Refresca memoria y UI
      line.maxQty = v;
      program.lines = program.lines.map(ln => {
        if ((ln.pn ?? ln.PN) === (updatedLine.pn ?? updatedLine.PN)) return { ...ln, maxQty: v };
        return ln;
      });
      renderList();
      modalEl.close();
    } catch (e) {
      alert("Error saving changes.");
      console.error(e);
    }
  };

  modalEl.replaceChildren(
    h("form", { method: "dialog", className: "modal-body" },
      h("h2", {}, "Edit line"),
      info,
      h("label", { className: "lbl" }, "Max Qty"),
      qtyInput,
      warn,
      h("div", { className: "actions" }, btnCancel, btnSave)
    )
  );
  modalEl.showModal();
}

// === Nueva: guardar en modo UPDATE (solo id + lines) ===
async function saveChanges(programId, lines) {
  const res = await fetch("/api/programs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: "update",
      id: programId,
      lines
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return await res.json();
}

// ---- Boot
async function boot() {
  try {
    [programs, customers] = await Promise.all([fetchPrograms(), loadCustomerSet()]);
    renderList();
  } catch (e) {
    tbody.replaceChildren(h("tr", {}, h("td", { colSpan: 16, className: "muted" }, "Failed to load")));
    console.error(e);
  }
}

q.addEventListener("input", renderList);
btnRefresh.addEventListener("click", boot);

boot();
