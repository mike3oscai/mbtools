// Render the three action cards for the Programs app
// NOTE: Pure, modular code—no side effects on import.

const ACTIONS = [
  {
    id: "create",
    title: "Create a Program",
    desc: "Start a new program and define its core attributes.",
    href: "./create/",
    icon: "＋" // placeholder; can be replaced by an SVG later
  },
  {
    id: "edit",
    title: "Edit a Program",
    desc: "Update details, timeline, and linked entities.",
    href: "./edit/",
    icon: "✎"
  },
  {
    id: "close",
    title: "Close a Program",
    desc: "Finalize and archive a completed or cancelled program.",
    href: "./close/",
    icon: "✓"
  },
  // 👉 NUEVA tarjeta
  {
    id: "retrieve",
    title: "Retrieve Programs",
    desc: "Browse and inspect all saved programs & their lines.",
    href: "./retrieve/",
    icon: "🔎"
  }
];

/** Small DOM helper (keeps us dependency-free) */
function h(tag, props = {}, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  for (const c of children.flat()) el.append(c?.nodeType ? c : document.createTextNode(c ?? ""));
  return el;
}

/** Public API: render the actions grid into #programs-actions */
export function renderProgramsActions() {
  const mount = document.getElementById("programs-actions");
  if (!mount) return;

  const cards = ACTIONS.map(a =>
    h("a", { className: "card action-card", href: a.href, "data-action": a.id },
      h("span", { className: "action-icon", "aria-hidden": "true" }, a.icon),
      h("h3", {}, a.title),
      h("p", {}, a.desc),
      h("span", { className: "action-cta" }, "Open")
    )
  );

  mount.replaceChildren(...cards);
}
