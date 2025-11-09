/* ProductBundle.js
   Mounts a single bundle per productId: Product, Pricing, Promotions.
   (Financials ahora es global y se monta en main.js)
*/

import { createEl } from "../utils.js";
import ProductCard from "./ProductCard.js";
import PricingCard from "./PricingCard.js";
import PromotionsCard from "./PromotionsCard.js";
import { on } from "../bus.js";

export default function mountProductBundle(root, productId) {
  const bundleId = `bundle-${productId}`;

  let bundle = document.getElementById(bundleId);
  if (bundle) return bundle;

  bundle = createEl("div", { className: "product-bundle", attrs: { id: bundleId, "data-product-id": productId } });
  root.append(bundle);

  // Orden: Product -> Pricing -> Promotions
  ProductCard(bundle, productId);
  PricingCard(bundle, productId);
  PromotionsCard(bundle, productId);

  const off = on("product:deleted", ({ productId: removed }) => {
    if (removed === productId) {
      off();
      bundle.remove();
    }
  });

  return bundle;
}
