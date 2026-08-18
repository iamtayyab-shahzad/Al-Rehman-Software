/** Soft-drink bottle sizes that require a brand/flavor pick. */
export const DRINK_FLAVOR_PRODUCT_IDS = new Set([
  "20000000-0000-4000-8000-000000000082", // 500 ml
  "20000000-0000-4000-8000-000000000083", // 1 Liter
  "20000000-0000-4000-8000-000000000084", // 1.5 Liter
  "20000000-0000-4000-8000-000000000085", // 2.25 Liter
]);

export const DEFAULT_DRINK_FLAVORS = ["Coke", "Sprite", "Fanta"];

export function requiresDrinkFlavor(product: {
  id?: string;
  name?: string;
}): boolean {
  if (product.id && DRINK_FLAVOR_PRODUCT_IDS.has(product.id)) return true;
  const n = (product.name || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!n.includes("drink")) return false;
  return (
    n.includes("500 ml") ||
    n.includes("500ml") ||
    n.includes("1 liter") ||
    n.includes("1.5 liter") ||
    n.includes("2.25 liter")
  );
}

/** Parse settings.drink_flavors JSON (or comma list) into clean unique names. */
export function parseDrinkFlavors(raw?: string | null): string[] {
  if (!raw?.trim()) return [...DEFAULT_DRINK_FLAVORS];
  const text = raw.trim();
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      const list = parsed
        .map((x) => String(x || "").trim())
        .filter(Boolean);
      return list.length ? uniquePreserve(list) : [...DEFAULT_DRINK_FLAVORS];
    }
  } catch {
    /* fall through to comma-split */
  }
  const list = text
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? uniquePreserve(list) : [...DEFAULT_DRINK_FLAVORS];
}

export function serializeDrinkFlavors(flavors: string[]): string {
  return JSON.stringify(
    uniquePreserve(flavors.map((f) => f.trim()).filter(Boolean)),
  );
}

function uniquePreserve(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function formatDrinkFlavorNote(flavor: string): string {
  return `Flavor: ${flavor.trim()}`;
}
