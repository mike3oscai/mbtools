// Retrieve Programs - full listing with all lines (Selected products)

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

// Preferimos el endpoint con include=lines; si no trae lines, hacemos fallback por id
async function fetchPrograms() {
  const res = await fetch("/api/programs?include=lines");
  if (!res.ok) throw new Error("Failed to load programs");
  const arr = await res.json();
  return Array.isArray(arr) ? arr : [];
}

async function fetchProgramById(id) {
  const r = await fetch(`/api/programs/${encodeURIComponent(id)}`);
  if (!r.ok) return null;
  return await r.json();
}

export async function renderRetrieve() {
  const tbody = document.getElementById("tbodyPrograms");
  const q = document.getElementById("q");
  const btnRefresh = document.getElementById("btnRefresh");
  const btnExpandAll = document.getElementById("btnExpandAll");

  let data = [];

  async function load() {
    tbody.replaceChildren(h("tr", {}, h("td", { colSpan: 12 }, "Loading…")));
    try {
      data = await fetchPrograms();
      // Fallback per-id si el backend aún no devuelve lines
      const anyWithoutLines = data.some(p => !Array.isArray(p.lines));
      if (anyWithoutLines) {
        for (const p of data) {
          if (!Array.isArray(p.lines)) {
            const full = await fetchProgramById(p.id);
            if (full && Array.isArray(full.lines)) p.lines = full.lines;
          }
        }
      }
      renderTable();
    } catch (e) {
      tbody.replaceChildren(h("tr", {}, h("td", { colSpan: 12 }, "Failed to load.")));
    }
  }

  function renderTable() {
    const term = q.value.trim().toLowerCase();
    const list = !term ? data : data.filter(p => {
      const hay = [
        p.programNumber, p.customer, p.geo, p.country, p.vertical, p.programType, p.id
      ].join(" ").toLowerCase();
      return hay.includes(term);
    });

    if (list.length === 0) {
      tbody.replaceChildren(h("tr", {}, h("td", { colSpan: 12 }, "No programs found.")));
      return;
    }

    const rows = [];
    for (const p of list) {
      const lineCount = Array.isArray(p.lines) ? p.lines.length : 0;
      const tr = h("tr", { "data-id": p.id },
        h("td", {}, p.programNumber || ""),
        h("td", {}, p.programType || ""),
        h("td", {}, p.geo || ""),
        h("td", {}, p.country || ""),
        h("td", {}, p.vertical || ""),
        h("td", {}, p.customer || ""),
        h("td", {}, fmtDate(p.startDay)),
        h("td", {}, fmtDate(p.endDay)),
        h("td", {}, fmtDate(p.createdAt)),
        h("td", {}, p.id),
        h("td", {}, String(lineCount)),
        h("td", {},
          h("button", { className: "action-cta btn-expand", type: "button" }, "Details")
        )
      );

      // Fila de detalle (oculta por defecto)
      const detail = h("tr", { className: "row-detail", style: "display:none" },
        h("td", { colSpan: 12 },
          renderLinesTable(p.lines || [])
        )
      );

      rows.push(tr, detail);
    }

    tbody.replaceChildren(...rows);

    // Wire expand buttons
    tbody.querySelectorAll(".btn-expand").forEach(btn => {
      btn.addEventListener("click", (ev) => {
        const r = ev.currentTarget.closest("tr");
        const next = r.nextElementSibling;
        if (!next || !next.classList.contains("row-detail")) return;
        next.style.display = (next.style.display === "none") ? "" : "none";
      });
    });
  }

  function renderLinesTable(lines) {
    if (!Array.isArray(lines) || lines.length === 0) {
      return h("div", {}, "No lines for this program.");
    }
    const tbl = h("table", { className: "w-full" },
      h("thead", {},
        h("tr", {},
          h("th", {}, "PN"),
          h("th", {}, "Description"),
          h("th", {}, "RRP"),
          h("th", {}, "Promo RRP"),
          h("th", {}, "VAT (Yes/No)"),
          h("th", {}, "FE - Rebate"),
          h("th", {}, "Max Qty"),
          h("th", {}, "Total Program Rebate"),
          h("th", {}, "Line Program Number")
        )
      ),
      h("tbody", {},
        ...lines.map(ln =>
          h("tr", {},
            h("td", {}, ln.pn ?? ""),
            h("td", {}, ln.description ?? ""),
            h("td", {}, fmtNum(ln.rrp)),
            h("td", {}, fmtNum(ln.promoRrp)),
            h("td", {}, ln.vatOnRrp ?? ""),
            h("td", {}, fmtNum(ln.rebate)),
            h("td", {}, fmtNum(ln.maxQty)),
            h("td", {}, fmtNum(ln.totalProgramRebate)),
            h("td", {}, ln.lineProgramNumber ?? "")
          )
        )
      )
    );
    return tbl;
  }

  // events
  q.addEventListener("input", renderTable);
  btnRefresh.addEventListener("click", load);
  btnExpandAll.addEventListener("click", () => {
    tbody.querySelectorAll(".row-detail").forEach(r => r.style.display = "");
  });

  // go!
  await load();
}
