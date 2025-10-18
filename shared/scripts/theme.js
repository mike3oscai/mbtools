// ===== Switch Light/Dark profesional con texto =====
export function initThemeToggle() {
  const html = document.documentElement;

  // Tema inicial
  const saved = localStorage.getItem("theme");
  const current = (saved === "dark" || saved === "light") ? saved : "light";
  html.setAttribute("data-theme", current);

  // Evitar duplicar switch si se llama dos veces
  if (document.querySelector(".theme-switch")) return;

  // Contenedor accesible
  const wrap = document.createElement("label");
  wrap.className = "theme-switch";
  wrap.setAttribute("role", "switch");
  wrap.setAttribute("tabindex", "0");
  wrap.setAttribute("aria-checked", String(current === "dark"));

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

  const apply = (isDark) => {
    const theme = isDark ? "dark" : "light";
    html.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    wrap.setAttribute("aria-checked", String(isDark));
  };

  input.addEventListener("change", () => apply(input.checked));

  // Accesible con teclado (Enter/Espacio)
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.checked = !input.checked;
      input.dispatchEvent(new Event("change"));
    }
  });
}
