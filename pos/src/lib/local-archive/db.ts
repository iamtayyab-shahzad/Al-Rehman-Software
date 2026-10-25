import fs from "fs";
import path from "path";
import type { Order } from "@/types";
import {
  ensureArchiveDir,
  getArchiveDbPath,
  getArchiveDir,
} from "@/lib/local-archive/paths";

export type ArchiveQuery = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type ArchiveStatus = {
  enabled: true;
  dbPath: string;
  archiveDir: string;
  orderCount: number;
  dbBytes: number;
  oldestCreatedAt: string | null;
  newestCreatedAt: string | null;
};

type ArchiveFile = {
  version: 1;
  orders: Record<string, Order>;
};

type CacheEntry = {
  data: ArchiveFile;
  dirty: boolean;
};

const cache = new Map<string, CacheEntry>();

function itemsSearchText(order: Order): string {
  return (order.items || [])
    .map(
      (item) =>
        item.product_name ||
        item.product?.name ||
        item.product_id ||
        "",
    )
    .filter(Boolean)
    .join(" ");
}

function emptyFile(): ArchiveFile {
  return { version: 1, orders: {} };
}

function loadFile(filePath: string): ArchiveFile {
  if (!fs.existsSync(filePath)) return emptyFile();
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) return emptyFile();
    const parsed = JSON.parse(raw) as ArchiveFile;
    if (!parsed || typeof parsed !== "object" || !parsed.orders) {
      return emptyFile();
    }
    return { version: 1, orders: parsed.orders };
  } catch {
    return emptyFile();
  }
}

function atomicWrite(filePath: string, data: ArchiveFile) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), "utf8");
  fs.renameSync(tmp, filePath);
}

function getStore(overrideRoot?: string): CacheEntry {
  const filePath = getArchiveDbPath(overrideRoot);
  let entry = cache.get(filePath);
  if (!entry) {
    ensureArchiveDir(overrideRoot);
    entry = { data: loadFile(filePath), dirty: false };
    cache.set(filePath, entry);
  }
  return entry;
}

function persist(overrideRoot?: string) {
  const filePath = getArchiveDbPath(overrideRoot);
  const entry = cache.get(filePath);
  if (!entry || !entry.dirty) return;
  atomicWrite(filePath, entry.data);
  entry.dirty = false;
}

export function openArchiveDb(overrideRoot?: string) {
  return getStore(overrideRoot);
}

export function closeArchiveDb(overrideRoot?: string) {
  const filePath = getArchiveDbPath(overrideRoot);
  const entry = cache.get(filePath);
  if (!entry) return;
  if (entry.dirty) {
    atomicWrite(filePath, entry.data);
  }
  cache.delete(filePath);
}

/** Upsert full order payloads. Safe to call often; never throws for empty input. */
export function upsertArchiveOrders(
  orders: Order[],
  overrideRoot?: string,
): { written: number } {
  if (!Array.isArray(orders) || orders.length === 0) {
    return { written: 0 };
  }
  const store = getStore(overrideRoot);
  let written = 0;
  for (const order of orders) {
    if (!order?.id) continue;
    const prev = store.data.orders[order.id];
    const createdAt =
      prev?.created_at &&
      (!order.created_at || prev.created_at < order.created_at)
        ? prev.created_at
        : order.created_at || new Date().toISOString();
    store.data.orders[order.id] = { ...order, created_at: createdAt };
    written += 1;
  }
  if (written > 0) {
    store.dirty = true;
    persist(overrideRoot);
  }
  return { written };
}

export function queryArchiveOrders(
  query: ArchiveQuery = {},
  overrideRoot?: string,
): Order[] {
  const store = getStore(overrideRoot);
  const status = (query.status || "").trim();
  const q = (query.q || "").trim().toLowerCase();
  const from = query.from || "";
  const to = query.to || "";
  const limit = Math.min(Math.max(Number(query.limit) || 500, 1), 5000);
  const offset = Math.max(Number(query.offset) || 0, 0);

  let rows = Object.values(store.data.orders);
  if (status && status !== "all") {
    rows = rows.filter((o) => o.order_status === status);
  }
  if (from) {
    rows = rows.filter((o) => (o.created_at || "") >= from);
  }
  if (to) {
    rows = rows.filter((o) => (o.created_at || "") <= to);
  }
  if (q) {
    rows = rows.filter((o) => {
      const hay = [
        o.order_number,
        o.customer_name,
        o.phone,
        o.id,
        o.client_order_id || "",
        itemsSearchText(o),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  return rows.slice(offset, offset + limit);
}

export function getArchiveOrderById(
  id: string,
  overrideRoot?: string,
): Order | null {
  const store = getStore(overrideRoot);
  if (store.data.orders[id]) return store.data.orders[id];
  for (const order of Object.values(store.data.orders)) {
    if (order.client_order_id === id) return order;
  }
  return null;
}

export function getArchiveStatus(overrideRoot?: string): ArchiveStatus {
  const store = getStore(overrideRoot);
  const filePath = getArchiveDbPath(overrideRoot);
  const rows = Object.values(store.data.orders);
  let oldest: string | null = null;
  let newest: string | null = null;
  for (const o of rows) {
    const c = o.created_at || "";
    if (!c) continue;
    if (!oldest || c < oldest) oldest = c;
    if (!newest || c > newest) newest = c;
  }

  let dbBytes = 0;
  try {
    dbBytes = fs.statSync(filePath).size;
  } catch {
    dbBytes = 0;
  }

  return {
    enabled: true,
    dbPath: filePath,
    archiveDir: getArchiveDir(overrideRoot),
    orderCount: rows.length,
    dbBytes,
    oldestCreatedAt: oldest,
    newestCreatedAt: newest,
  };
}

/** Write a CSV snapshot next to the archive file for Excel / USB copy. */
export function exportArchiveCsv(
  overrideRoot?: string,
): { csvPath: string; rows: number } {
  const archiveDir = ensureArchiveDir(overrideRoot);
  const stamp = new Date().toISOString().slice(0, 10);
  const csvPath = path.join(archiveDir, `orders-export-${stamp}.csv`);
  const store = getStore(overrideRoot);
  const rows = Object.values(store.data.orders).sort((a, b) =>
    (b.created_at || "").localeCompare(a.created_at || ""),
  );

  const escape = (value: string | number) => {
    const s = String(value ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [
    "order_number,created_at,order_status,customer_name,phone,grand_total,items,id",
    ...rows.map((r) =>
      [
        r.order_number,
        r.created_at,
        r.order_status,
        r.customer_name,
        r.phone,
        r.grand_total,
        itemsSearchText(r),
        r.id,
      ]
        .map(escape)
        .join(","),
    ),
  ];
  fs.writeFileSync(csvPath, lines.join("\n"), "utf8");
  return { csvPath, rows: rows.length };
}
