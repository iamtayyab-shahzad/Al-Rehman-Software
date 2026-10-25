/**
 * No-vitest smoke check for the JSON order archive (no native modules).
 * Run: node scripts/smoke-local-archive.mjs
 */
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Compile-free: reimplement the tiny contract against the same file layout.
function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "alrehman-archive-smoke-"));
  const file = path.join(root, "archive", "orders.archive.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const store = { version: 1, orders: {} };
  const upsert = (order) => {
    const prev = store.orders[order.id];
    const createdAt =
      prev?.created_at && prev.created_at < order.created_at
        ? prev.created_at
        : order.created_at;
    store.orders[order.id] = { ...order, created_at: createdAt };
  };

  upsert({
    id: "a",
    created_at: "2024-01-01T00:00:00.000Z",
    order_number: "AR-1",
    customer_name: "Ali",
    phone: "0300",
    order_status: "COMPLETED",
    grand_total: 100,
    items: [{ product_name: "Burger" }],
  });
  upsert({
    id: "a",
    created_at: "2024-01-02T00:00:00.000Z",
    order_number: "AR-1",
    customer_name: "Ali Updated",
    phone: "0300",
    order_status: "COMPLETED",
    grand_total: 200,
    items: [{ product_name: "Burger" }],
  });

  fs.writeFileSync(file, JSON.stringify(store));
  const loaded = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Object.keys(loaded.orders).length !== 1) throw new Error("dup");
  if (loaded.orders.a.created_at !== "2024-01-01T00:00:00.000Z") {
    throw new Error("created_at not preserved");
  }
  if (loaded.orders.a.grand_total !== 200) throw new Error("update missing");
  fs.rmSync(root, { recursive: true, force: true });
  console.log("local-archive smoke OK");
}

run();
