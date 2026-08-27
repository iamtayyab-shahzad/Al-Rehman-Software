/**
 * Sync shared shop + menu config into the frontend apps.
 *
 * Usage (repo root):
 *   node scripts/sync-shop-config.mjs
 *
 * Edit shared/shop.json and shared/menu.json first, then run this
 * before building/deploying website, POS, or admin for a shop.
 */
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const shopSrc = join(root, "shared", "shop.json");
const menuSrc = join(root, "shared", "menu.json");

const shopTargets = [
  join(root, "website", "src", "data", "shop.json"),
  join(root, "pos", "src", "data", "shop.json"),
  join(root, "admin", "src", "data", "shop.json"),
];

const menuTargets = [
  join(root, "website", "src", "data", "menu.json"),
  join(root, "pos", "src", "data", "menu.json"),
];

function requireFile(path, label) {
  if (!existsSync(path)) {
    console.error(`Missing ${label}: ${path}`);
    process.exit(1);
  }
}

requireFile(shopSrc, "shared/shop.json");
requireFile(menuSrc, "shared/menu.json");

for (const dest of shopTargets) {
  copyFileSync(shopSrc, dest);
  console.log(`shop.json → ${dest}`);
}

for (const dest of menuTargets) {
  copyFileSync(menuSrc, dest);
  console.log(`menu.json → ${dest}`);
}

console.log("Done. Rebuild / redeploy frontends so changes take effect.");
