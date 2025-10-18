// ===== Switch Light/Dark profesional con texto =====
export function initThemeToggle() {
  const html = document.documentElement;
  const saved = localStorage.getItem("theme");
  const current = saved || "light";
  html.dataset.theme = current;

  // Contenedor (label) + checkbox accesible + pista visual
  const wrap = document.createElement("label");
  wrap.className = "theme-switch";
  wrap.setAttribute("role", "switch");
  wrap.setAttribute("aria-checked", current === "dark");

  wrap.innerHTML = `
    <input type="checkbox" aria-label="Cambiar tema" ${current === "dark" ? "checked" : ""}>
    <span class="track">
      <span class="thumb"></span>
      <span class="labels">
        <span class="light">Light Mode</span>
        <span class="dark">Dark Mode</span>
      </span>
    </span>
  `;

  document.body.appendChild(wrap);

  const input = wrap.querySelector("input");

  const sync = (isDark) => {
    html.dataset.theme = isDark ? "dark" : "light";
    localStorage.setItem("theme", html.dataset.theme);
    wrap.setAttribute("aria-checked", isDark);
  };

  input.addEventListener("change", () => sync(input.checked));

  // Accesible con teclado (Enter/Espacio)
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.checked = !input.checked;
      input.dispatchEvent(new Event("change"));
    }
  });
}
