import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import type { Order } from "@/types";
import {
  closeArchiveDb,
  exportArchiveCsv,
  getArchiveOrderById,
  getArchiveStatus,
  queryArchiveOrders,
  upsertArchiveOrders,
} from "@/lib/local-archive/db";
import { getArchiveDbPath } from "@/lib/local-archive/paths";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "alrehman-archive-"));
}

function makeOrder(partial: Partial<Order> & { id: string }): Order {
  return {
    created_at: partial.created_at || "2024-01-15T10:00:00.000Z",
    updated_at: partial.updated_at || partial.created_at || "2024-01-15T10:00:00.000Z",
    order_number: partial.order_number || `AR-${partial.id}`,
    client_order_id: partial.client_order_id ?? null,
    customer_name: partial.customer_name || "Walk-in",
    phone: partial.phone || "03001234567",
    address: partial.address || "",
    location_id: partial.location_id || "",
    delivery_charge: partial.delivery_charge || 0,
    cash_on_delivery_fee: partial.cash_on_delivery_fee || 0,
    payment_method: partial.payment_method || "cash",
    order_status: partial.order_status || "COMPLETED",
    order_type: partial.order_type || "walkin",
    order_notes: partial.order_notes || "",
    subtotal: partial.subtotal ?? 500,
    grand_total: partial.grand_total ?? 500,
    items: partial.items || [
      {
        id: `item-${partial.id}`,
        created_at: "",
        updated_at: "",
        order_id: partial.id,
        product_id: "p1",
        product_size_id: "s1",
        quantity: 2,
        price: 250,
        product_name: "Chicken Burger",
      },
    ],
    ...partial,
  };
}

const roots: string[] = [];

afterEach(() => {
  while (roots.length) {
    const root = roots.pop()!;
    closeArchiveDb(root);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("local SQLite archive", () => {
  it("stores orders on disk and returns them instantly by search", () => {
    const root = tempRoot();
    roots.push(root);

    const older = makeOrder({
      id: "ord-old",
      created_at: "2023-06-01T12:00:00.000Z",
      customer_name: "Ali Khan",
      phone: "03011111111",
      order_number: "AR-2023-1",
      order_status: "COMPLETED",
      grand_total: 1200,
    });
    const newer = makeOrder({
      id: "ord-new",
      created_at: "2026-03-20T08:00:00.000Z",
      customer_name: "Zia",
      phone: "03022222222",
      order_number: "AR-2026-9",
      order_status: "COMPLETED",
      items: [
        {
          id: "i2",
          created_at: "",
          updated_at: "",
          order_id: "ord-new",
          product_id: "p2",
          product_size_id: "s2",
          quantity: 1,
          price: 800,
          product_name: "Tikka Roll",
        },
      ],
    });

    expect(upsertArchiveOrders([older, newer], root)).toEqual({ written: 2 });
    expect(fs.existsSync(getArchiveDbPath(root))).toBe(true);

    const byName = queryArchiveOrders({ q: "ali" }, root);
    expect(byName).toHaveLength(1);
    expect(byName[0].id).toBe("ord-old");
    expect(byName[0].grand_total).toBe(1200);

    const byProduct = queryArchiveOrders({ q: "tikka" }, root);
    expect(byProduct.map((o) => o.id)).toEqual(["ord-new"]);

    const byYear = queryArchiveOrders(
      { from: "2026-01-01", to: "2026-12-31T23:59:59.999Z" },
      root,
    );
    expect(byYear.map((o) => o.id)).toEqual(["ord-new"]);

    const status = getArchiveStatus(root);
    expect(status.enabled).toBe(true);
    expect(status.orderCount).toBe(2);
    expect(status.oldestCreatedAt).toBe("2023-06-01T12:00:00.000Z");
    expect(status.newestCreatedAt).toBe("2026-03-20T08:00:00.000Z");
    expect(status.dbBytes).toBeGreaterThan(0);
  });

  it("upserts the same id without duplicating and keeps earlier created_at", () => {
    const root = tempRoot();
    roots.push(root);

    upsertArchiveOrders(
      [
        makeOrder({
          id: "ord-1",
          created_at: "2025-01-01T00:00:00.000Z",
          order_status: "PENDING",
          customer_name: "A",
        }),
      ],
      root,
    );
    upsertArchiveOrders(
      [
        makeOrder({
          id: "ord-1",
          created_at: "2025-01-02T00:00:00.000Z",
          order_status: "COMPLETED",
          customer_name: "A Updated",
          grand_total: 999,
        }),
      ],
      root,
    );

    const all = queryArchiveOrders({ limit: 10 }, root);
    expect(all).toHaveLength(1);
    expect(all[0].order_status).toBe("COMPLETED");
    expect(all[0].customer_name).toBe("A Updated");
    expect(all[0].grand_total).toBe(999);
    // Prefer the original ticket time.
    expect(all[0].created_at).toBe("2025-01-01T00:00:00.000Z");
  });

  it("handles thousands of rows and filters by status quickly", () => {
    const root = tempRoot();
    roots.push(root);

    const batch: Order[] = [];
    for (let i = 0; i < 2500; i++) {
      batch.push(
        makeOrder({
          id: `bulk-${i}`,
          created_at: new Date(Date.UTC(2022, 0, 1) + i * 60_000).toISOString(),
          order_number: `AR-B-${i}`,
          customer_name: i % 2 === 0 ? "Even Customer" : "Odd Customer",
          phone: `0300${String(i).padStart(7, "0")}`,
          order_status: i % 3 === 0 ? "CANCELLED" : "COMPLETED",
          grand_total: 100 + i,
        }),
      );
    }

    const started = Date.now();
    const { written } = upsertArchiveOrders(batch, root);
    const writeMs = Date.now() - started;
    expect(written).toBe(2500);
    expect(writeMs).toBeLessThan(15_000);

    const qStarted = Date.now();
    const cancelled = queryArchiveOrders(
      { status: "CANCELLED", limit: 5000 },
      root,
    );
    const queryMs = Date.now() - qStarted;
    expect(cancelled.length).toBeGreaterThan(800);
    expect(cancelled.every((o) => o.order_status === "CANCELLED")).toBe(true);
    expect(queryMs).toBeLessThan(2_000);

    const found = getArchiveOrderById("bulk-1234", root);
    expect(found?.order_number).toBe("AR-B-1234");
  });

  it("exports a CSV file next to the database", () => {
    const root = tempRoot();
    roots.push(root);

    upsertArchiveOrders(
      [
        makeOrder({
          id: "csv-1",
          customer_name: 'Name, "Quoted"',
          order_number: "AR-CSV",
        }),
      ],
      root,
    );

    const { csvPath, rows } = exportArchiveCsv(root);
    expect(rows).toBe(1);
    expect(fs.existsSync(csvPath)).toBe(true);
    const text = fs.readFileSync(csvPath, "utf8");
    expect(text).toContain("order_number,created_at");
    expect(text).toContain("AR-CSV");
    expect(text).toContain('"Name, ""Quoted"""');
  });
});
