// Renders only the header row (no inputs yet). Pure, modular code.

const FIELDS = [
  "Program Type",
  "Customer",
  "Activity",
  "Start Day",
  "End Day",
  "PN",
  "Product",
  "RAM",
  "ROM",
  "RRP",
  "Promo RRP",
  "Calculated on RRP - VAT (Yes/No)",
  "Rebate",
  "Max Quantity",
  "Total Program Rebate",
  "Program Number"
];

/** Small DOM helper */
function h(tag, props = {}, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  for (const c of children.flat()) el.append(c?.nodeType ? c : document.createTextNode(c ?? ""));
  return el;
}

/** Public API: render the header grid */
export function renderHeaderGrid() {
  const host = document.getElementById("program-header-grid");
  if (!host) return;

  const headerCells = FIELDS.map(label => h("div", { className: "cell", title: label }, label));
  host.replaceChildren(...headerCells);
}
