import Database from "better-sqlite3";
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

type ArchiveRow = {
  id: string;
  client_order_id: string | null;
  order_number: string;
  created_at: string;
  updated_at: string;
  order_status: string;
  customer_name: string;
  phone: string;
  grand_total: number;
  items_text: string;
  payload: string;
};

const openDbs = new Map<string, Database.Database>();

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

function toRow(order: Order): ArchiveRow {
  return {
    id: order.id,
    client_order_id: order.client_order_id || null,
    order_number: order.order_number || "",
    created_at: order.created_at || new Date().toISOString(),
    updated_at: order.updated_at || order.created_at || new Date().toISOString(),
    order_status: order.order_status || "",
    customer_name: order.customer_name || "",
    phone: order.phone || "",
    grand_total: Number(order.grand_total) || 0,
    items_text: itemsSearchText(order),
    payload: JSON.stringify(order),
  };
}

function rowToOrder(row: ArchiveRow): Order {
  try {
    const parsed = JSON.parse(row.payload) as Order;
    return {
      ...parsed,
      // Indexed columns are the source of truth for search/sort fields.
      id: row.id,
      client_order_id: row.client_order_id,
      order_number: row.order_number,
      created_at: row.created_at,
      updated_at: row.updated_at,
      order_status: row.order_status,
      customer_name: row.customer_name,
      phone: row.phone,
      grand_total: row.grand_total,
    };
  } catch {
    return {
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      order_number: row.order_number,
      client_order_id: row.client_order_id,
      customer_name: row.customer_name,
      phone: row.phone,
      address: "",
      location_id: "",
      delivery_charge: 0,
      cash_on_delivery_fee: 0,
      payment_method: "",
      order_status: row.order_status,
      order_type: "",
      order_notes: "",
      subtotal: row.grand_total,
      grand_total: row.grand_total,
      items: [],
    };
  }
}

export function openArchiveDb(overrideRoot?: string): Database.Database {
  const dbPath = getArchiveDbPath(overrideRoot);
  const cached = openDbs.get(dbPath);
  if (cached) return cached;

  ensureArchiveDir(overrideRoot);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY NOT NULL,
      client_order_id TEXT,
      order_number TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      order_status TEXT NOT NULL DEFAULT '',
      customer_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      grand_total REAL NOT NULL DEFAULT 0,
      items_text TEXT NOT NULL DEFAULT '',
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
    CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
    CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_name);
    CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_order_id);
  `);

  openDbs.set(dbPath, db);
  return db;
}

export function closeArchiveDb(overrideRoot?: string) {
  const dbPath = getArchiveDbPath(overrideRoot);
  const db = openDbs.get(dbPath);
  if (!db) return;
  db.close();
  openDbs.delete(dbPath);
}

/** Upsert full order payloads. Safe to call often; never throws for empty input. */
export function upsertArchiveOrders(
  orders: Order[],
  overrideRoot?: string,
): { written: number } {
  if (!Array.isArray(orders) || orders.length === 0) {
    return { written: 0 };
  }
  const db = openArchiveDb(overrideRoot);
  const stmt = db.prepare(`
    INSERT INTO orders (
      id, client_order_id, order_number, created_at, updated_at,
      order_status, customer_name, phone, grand_total, items_text, payload
    ) VALUES (
      @id, @client_order_id, @order_number, @created_at, @updated_at,
      @order_status, @customer_name, @phone, @grand_total, @items_text, @payload
    )
    ON CONFLICT(id) DO UPDATE SET
      client_order_id = excluded.client_order_id,
      order_number = excluded.order_number,
      created_at = CASE
        WHEN excluded.created_at < orders.created_at THEN excluded.created_at
        ELSE orders.created_at
      END,
      updated_at = excluded.updated_at,
      order_status = excluded.order_status,
      customer_name = excluded.customer_name,
      phone = excluded.phone,
      grand_total = excluded.grand_total,
      items_text = excluded.items_text,
      payload = excluded.payload
  `);

  const existingCreated = db.prepare(
    "SELECT created_at FROM orders WHERE id = ?",
  );

  const tx = db.transaction((rows: Order[]) => {
    let written = 0;
    for (const order of rows) {
      if (!order?.id) continue;
      const prev = existingCreated.get(order.id) as
        | { created_at: string }
        | undefined;
      const createdAt =
        prev?.created_at &&
        (!order.created_at || prev.created_at < order.created_at)
          ? prev.created_at
          : order.created_at || new Date().toISOString();
      const stabilized: Order = { ...order, created_at: createdAt };
      stmt.run(toRow(stabilized));
      written += 1;
    }
    return written;
  });

  return { written: tx(orders) };
}

export function queryArchiveOrders(
  query: ArchiveQuery = {},
  overrideRoot?: string,
): Order[] {
  const db = openArchiveDb(overrideRoot);
  const where: string[] = [];
  const params: Record<string, string | number> = {};

  const status = (query.status || "").trim();
  if (status && status !== "all") {
    where.push("order_status = @status");
    params.status = status;
  }
  if (query.from) {
    where.push("created_at >= @from");
    params.from = query.from;
  }
  if (query.to) {
    where.push("created_at <= @to");
    params.to = query.to;
  }
  const q = (query.q || "").trim().toLowerCase();
  if (q) {
    where.push(`(
      lower(order_number) LIKE @q
      OR lower(customer_name) LIKE @q
      OR lower(phone) LIKE @q
      OR lower(id) LIKE @q
      OR lower(ifnull(client_order_id, '')) LIKE @q
      OR lower(items_text) LIKE @q
    )`);
    params.q = `%${q}%`;
  }

  const limit = Math.min(Math.max(Number(query.limit) || 500, 1), 5000);
  const offset = Math.max(Number(query.offset) || 0, 0);
  params.limit = limit;
  params.offset = offset;

  const sql = `
    SELECT * FROM orders
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY created_at DESC
    LIMIT @limit OFFSET @offset
  `;
  const rows = db.prepare(sql).all(params) as ArchiveRow[];
  return rows.map(rowToOrder);
}

export function getArchiveOrderById(
  id: string,
  overrideRoot?: string,
): Order | null {
  const db = openArchiveDb(overrideRoot);
  const row = db
    .prepare("SELECT * FROM orders WHERE id = ? OR client_order_id = ? LIMIT 1")
    .get(id, id) as ArchiveRow | undefined;
  return row ? rowToOrder(row) : null;
}

export function getArchiveStatus(overrideRoot?: string): ArchiveStatus {
  const db = openArchiveDb(overrideRoot);
  const dbPath = getArchiveDbPath(overrideRoot);
  const stats = db
    .prepare(
      `SELECT
        COUNT(*) AS orderCount,
        MIN(created_at) AS oldestCreatedAt,
        MAX(created_at) AS newestCreatedAt
      FROM orders`,
    )
    .get() as {
    orderCount: number;
    oldestCreatedAt: string | null;
    newestCreatedAt: string | null;
  };

  let dbBytes = 0;
  try {
    dbBytes = fs.statSync(dbPath).size;
  } catch {
    dbBytes = 0;
  }

  return {
    enabled: true,
    dbPath,
    archiveDir: getArchiveDir(overrideRoot),
    orderCount: Number(stats.orderCount) || 0,
    dbBytes,
    oldestCreatedAt: stats.oldestCreatedAt || null,
    newestCreatedAt: stats.newestCreatedAt || null,
  };
}

/** Write a CSV snapshot next to the SQLite file for Excel / USB copy. */
export function exportArchiveCsv(
  overrideRoot?: string,
): { csvPath: string; rows: number } {
  const db = openArchiveDb(overrideRoot);
  const archiveDir = ensureArchiveDir(overrideRoot);
  const stamp = new Date().toISOString().slice(0, 10);
  const csvPath = path.join(archiveDir, `orders-export-${stamp}.csv`);

  const rows = db
    .prepare(
      `SELECT order_number, created_at, order_status, customer_name, phone,
              grand_total, items_text, id
       FROM orders
       ORDER BY created_at DESC`,
    )
    .all() as Array<{
    order_number: string;
    created_at: string;
    order_status: string;
    customer_name: string;
    phone: string;
    grand_total: number;
    items_text: string;
    id: string;
  }>;

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
        r.items_text,
        r.id,
      ]
        .map(escape)
        .join(","),
    ),
  ];
  fs.writeFileSync(csvPath, lines.join("\n"), "utf8");
  return { csvPath, rows: rows.length };
}
