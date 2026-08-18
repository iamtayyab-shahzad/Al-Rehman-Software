import type { Product } from "@/types";

export type PizzaSizeCode = "S" | "M" | "L" | "XL";
export type PizzaTier = "regular" | "special";

export type DealPizzaSlot = {
  id: string;
  label: string;
  size: PizzaSizeCode;
  tier: PizzaTier;
};

/** Deterministic IDs from shared/krunchies-menu.json — works even if category.name is missing. */
const REGULAR_PIZZA_CATEGORY_IDS = new Set([
  "10000000-0000-4000-8000-000000000009",
]);
const SPECIAL_PIZZA_CATEGORY_IDS = new Set([
  "10000000-0000-4000-8000-000000000010",
  "10000000-0000-4000-8000-000000000011",
]);
/** Flyer/combo deals category — any new product in this category is a deal. */
const DEALS_CATEGORY_IDS = new Set([
  "10000000-0000-4000-8000-000000000012",
]);

const SIZE_ALIASES: Record<string, PizzaSizeCode> = {
  small: "S",
  s: "S",
  medium: "M",
  m: "M",
  large: "L",
  l: "L",
  xl: "XL",
  "extra large": "XL",
  "x large": "XL",
  xlarge: "XL",
  "x-large": "XL",
};

/** Parse deal description into pizza flavor slots matching size + regular/special. */
export function parseDealPizzaSlots(description: string): DealPizzaSlot[] {
  const slots: DealPizzaSlot[] = [];
  const re =
    /(\d+)\s*(small|medium|large|x\s*large|xl|extra\s*large|s|m|l)\s+pizzas?(?:\s+(special))?/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(description)) !== null) {
    const count = Math.min(8, Math.max(1, Number(match[1]) || 1));
    const sizeToken = match[2].toLowerCase().replace(/\s+/g, " ").trim();
    const size = SIZE_ALIASES[sizeToken] || "L";
    const tier: PizzaTier = match[3] ? "special" : "regular";
    for (let i = 0; i < count; i += 1) {
      const n = slots.length + 1;
      const tierLabel = tier === "special" ? "Special" : "Regular";
      slots.push({
        id: `pizza-${n}`,
        label: `${tierLabel} pizza flavor ${n} (${size})`,
        size,
        tier,
      });
    }
  }
  return slots;
}

export function isDealProduct(product: Product) {
  const catId = product.category_id || product.category?.id;
  if (catId && DEALS_CATEGORY_IDS.has(catId)) return true;
  const name = (product.category?.name || "").toLowerCase();
  if (name.includes("deal")) return true;
  const productName = (product.name || "").toLowerCase();
  return productName.includes("deal") || productName.includes("mega combo");
}

/** Split a deal description into cook-facing included items. */
export function parseDealIncludedItems(description: string | undefined | null): string[] {
  const raw = (description || "").trim();
  if (!raw) return [];
  const withoutPromo = raw
    .replace(/home delivery free!?/gi, "")
    .replace(/perfect combo[^.!]*/gi, "")
    .replace(/great taste[^.!]*/gi, "")
    .replace(/best value!?/gi, "")
    .replace(/mazay ka[^.!]*/gi, "")
    .replace(/choose flavor[^.!]*/gi, "");
  const parts = withoutPromo
    .split(/,|\band\b/gi)
    .map((p) => p.replace(/[.!]+$/g, "").trim())
    .filter((p) => p.length > 2 && !/^perfect|^great|^best|^mazay/i.test(p));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }
  return out;
}

export function requiresDealFlavorChoice(product: Product) {
  return (
    isDealProduct(product) &&
    parseDealPizzaSlots(product.description || "").length > 0
  );
}

function categoryIdOf(product: Product): string {
  return (product.category_id || product.category?.id || "").toLowerCase();
}

function isRegularPizzaProduct(product: Product): boolean {
  const id = categoryIdOf(product);
  if (REGULAR_PIZZA_CATEGORY_IDS.has(id)) return true;
  const cat = (product.category?.name || "").toLowerCase();
  return cat.includes("regular") && cat.includes("pizza");
}

function isSpecialPizzaProduct(product: Product): boolean {
  const id = categoryIdOf(product);
  if (SPECIAL_PIZZA_CATEGORY_IDS.has(id)) return true;
  const cat = (product.category?.name || "").toLowerCase();
  if (cat.includes("burger") || cat.includes("regular")) return false;
  return cat.includes("special") && cat.includes("pizza");
}

/** Flavours for a slot: Regular or Special pizza categories with matching size. */
export function flavorsForSlot(
  products: Product[],
  slot: DealPizzaSlot,
): Product[] {
  return products.filter((p) => {
    if (isDealProduct(p)) return false;
    const tierOk =
      slot.tier === "special"
        ? isSpecialPizzaProduct(p)
        : isRegularPizzaProduct(p);
    if (!tierOk) return false;
    return (p.sizes || []).some((s) => normalizeSize(s.size) === slot.size);
  });
}

export function normalizeSize(size: string): PizzaSizeCode | null {
  const t = size.trim().toUpperCase();
  if (t === "S" || t === "SMALL") return "S";
  if (t === "M" || t === "MEDIUM") return "M";
  if (t === "L" || t === "LARGE") return "L";
  if (t === "XL" || t === "EXTRA LARGE" || t === "X-LARGE") return "XL";
  return null;
}
