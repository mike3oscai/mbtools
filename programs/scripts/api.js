// Simulación de “datos” por ahora.
// Más adelante, este módulo podrá leer de otra app o de un endpoint.
export async function fetchPrograms() {
  return [
    { id: "prog-001", name: "Launch 2025", status: "draft", desc: "Programa de lanzamiento Q1." },
    { id: "prog-002", name: "Promo Spring", status: "active", desc: "Campaña primavera." },
  ];
}
