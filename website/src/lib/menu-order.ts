/**
 * Preferred "All Items" order. Matched by English category name from the catalog
 * so new categories (sweets, samosas, cakes) can be added from the menu file
 * without changing this list first.
 */
export function categoryBrowseRank(name: string): number {
  const n = (name || "").toLowerCase().trim();

  if (n.includes("deal")) return 0;
  if (n.includes("premium") && n.includes("pizza")) return 1;
  if (n.includes("standard") && n.includes("pizza")) return 2;
  if (n.includes("pizza")) return 3;

  if (n.includes("burger")) return 4;
  if (n.includes("sandwich")) return 5;
  if (n.includes("roll") || n.includes("shawarma") || n.includes("paratha") || n.includes("pratha"))
    return 6;
  if (n.includes("broast") || n.includes("fried") || n.includes("chicken")) return 7;
  if (n.includes("wing") || n.includes("nugget") || n.includes("snack")) return 8;
  if (n.includes("pasta")) return 9;
  if (n.includes("fries") || n.includes("fry")) return 10;
  if (n.includes("chinese") || n.includes("chowmein") || n.includes("nacho")) return 11;
  if (n.includes("samosa")) return 20;
  if (n.includes("sweet") || n.includes("mithai")) return 21;
  if (n.includes("cake") || n.includes("bakery")) return 22;
  if (n.includes("shake")) return 23;
  if (n.includes("cold") || n.includes("drink")) return 24;

  return 40;
}
