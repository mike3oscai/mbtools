// ===== Modo oscuro / claro =====
export function initThemeToggle() {
  const html = document.documentElement;
  const saved = localStorage.getItem("theme");
  const current = saved || "light";
  html.dataset.theme = current;

  // Crear botón
  const btn = document.createElement("button");
  btn.textContent = current === "dark" ? "☀️" : "🌙";
  btn.title = "Cambiar tema";
  Object.assign(btn.style, {
    position: "fixed",
    top: "1rem",
    right: "1rem",
    fontSize: "1.4rem",
    background: "transparent",
    border: "none",
    cursor: "pointer",
  });
  document.body.append(btn);

  btn.addEventListener("click", () => {
    const newTheme = html.dataset.theme === "light" ? "dark" : "light";
    html.dataset.theme = newTheme;
    localStorage.setItem("theme", newTheme);
    btn.textContent = newTheme === "dark" ? "☀️" : "🌙";
  });
}
