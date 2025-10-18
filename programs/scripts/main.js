import { fetchPrograms } from "./api.js";
import { h } from "../../shared/scripts/dom.js";

export async function renderPrograms() {
  const host = document.getElementById("programs-list");
  const data = await fetchPrograms();

  host.replaceChildren(...data.map(p =>
    h("a",
      { className:"card program-card", href:`./view.html?id=${encodeURIComponent(p.id)}` },
      h("h3", {}, p.name),
      h("p", {}, p.desc),
      h("span", { className:"badge" }, p.status)
    )
  ));
}
