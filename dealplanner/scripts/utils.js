/* utils.js
   Common helpers: DOM, formatting, numeric binding, ids.
*/

export function uid() {
  return "p_" + Math.random().toString(36).slice(2, 9);
}

export function toFixed2(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0.00";
  return v.toFixed(2);
}

export function round2(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

export function clampPercent2(n) {
  const v = round2(n);
  return Math.max(0, Math.min(100, v));
}

export function uniqueSorted(arr) {
  return [...new Set(arr.filter(v => v !== undefined && v !== null && String(v).trim() !== ""))]
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }));
}

export function createEl(tag, opts = {}) {
  const el = document.createElement(tag);
  if (opts.className) el.className = opts.className;
  if (opts.text) el.textContent = opts.text;
  if (opts.html) el.innerHTML = opts.html;
  if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) el.setAttribute(k, v);
  return el;
}

export function ensureMainContainer() {
  let main = document.querySelector("main.container");
  if (!main) {
    main = createEl("main", { className: "container" });
    document.body.appendChild(main);
  }
  return main;
}

/** Bind a numeric input to state with 2-decimals formatting.
 *  Options: { percent?: boolean, readonly?: boolean, onBlur?: fn }
 */
export function bindNumberInput(inputEl, get, set, opts = {}) {
  inputEl.setAttribute("type", "number");
  inputEl.setAttribute("step", "0.01");
  inputEl.setAttribute("inputmode", "decimal");
  inputEl.setAttribute("min", opts.percent ? "0" : "0");
  if (opts.percent) inputEl.setAttribute("max", "100");
  if (opts.readonly) inputEl.setAttribute("readonly", "readonly");

  inputEl.value = toFixed2(get());

  inputEl.addEventListener("input", () => {
    const raw = Number(inputEl.value);
    let val = Number.isFinite(raw) ? raw : 0;
    val = opts.percent ? clampPercent2(val) : round2(val);
    set(val);
    opts.onInput?.(val);
  });

  inputEl.addEventListener("blur", () => {
    const raw = get();
    let v = opts.percent ? clampPercent2(raw) : round2(raw);
    set(v);
    inputEl.value = toFixed2(v);
    opts.onBlur?.(v);
  });
}
