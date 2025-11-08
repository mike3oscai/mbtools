/* ProductBundle.js */
import { createEl } from "../utils.js";
import ProductCard from "./ProductCard.js";
import PricingCard from "./PricingCard.js";      // <- asegúrate que apunta aquí
import FinancialsCard from "./FinancialsCard.js";
import { on } from "../bus.js";

export default function mountProductBundle(root, productId) {
  const bundle = createEl("div", { className: "product-bundle" });
  root.append(bundle);

  ProductCard(bundle, productId);
  PricingCard(bundle, productId);                // <- se monta Pricing aquí
  FinancialsCard(bundle, productId);

  const off = on("product:deleted", ({ productId: removed }) => {
    if (removed === productId) {
      off();
      bundle.remove();
    }
  });

  return bundle;
}
