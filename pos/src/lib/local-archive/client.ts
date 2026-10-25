import type { Order } from "@/types";

export type LocalArchiveStatusResponse =
  | {
      enabled: true;
      dbPath: string;
      archiveDir: string;
      orderCount: number;
      dbBytes: number;
      oldestCreatedAt: string | null;
      newestCreatedAt: string | null;
    }
  | { enabled: false; reason?: string };

function isBrowserLocalHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "127.0.0.1" || host === "localhost";
}

/** Local SQLite archive only runs on the shop PC Next server. */
export function canUseLocalArchive() {
  return isBrowserLocalHost();
}

let archiveQueue: Order[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

async function flushArchiveQueue() {
  if (flushing || archiveQueue.length === 0 || !canUseLocalArchive()) return;
  flushing = true;
  const batch = archiveQueue;
  archiveQueue = [];
  try {
    const res = await fetch("/api/local-archive/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders: batch }),
      keepalive: true,
    });
    if (!res.ok) {
      // Put back for a later attempt — never block cashiers.
      archiveQueue = batch.concat(archiveQueue);
    }
  } catch {
    archiveQueue = batch.concat(archiveQueue);
  } finally {
    flushing = false;
    if (archiveQueue.length) scheduleFlush(2_000);
  }
}

function scheduleFlush(delayMs = 250) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushArchiveQueue();
  }, delayMs);
}

/**
 * Fire-and-forget durable write to the PC SQLite file.
 * Batches rapid order updates so the till stays snappy.
 */
export function mirrorOrdersToLocalArchive(orders: Order | Order[]) {
  if (!canUseLocalArchive()) return;
  const list = Array.isArray(orders) ? orders : [orders];
  const valid = list.filter((o) => o && typeof o.id === "string");
  if (!valid.length) return;
  archiveQueue.push(...valid);
  scheduleFlush();
}

export async function fetchLocalArchiveStatus(): Promise<LocalArchiveStatusResponse> {
  if (!canUseLocalArchive()) {
    return { enabled: false, reason: "not_local_host" };
  }
  try {
    const res = await fetch("/api/local-archive", { cache: "no-store" });
    if (!res.ok) return { enabled: false, reason: "http_error" };
    return (await res.json()) as LocalArchiveStatusResponse;
  } catch {
    return { enabled: false, reason: "unreachable" };
  }
}

export async function searchLocalArchive(params: {
  q?: string;
  status?: string;
  limit?: number;
}): Promise<Order[]> {
  if (!canUseLocalArchive()) return [];
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.status) sp.set("status", params.status);
  if (params.limit) sp.set("limit", String(params.limit));
  try {
    const res = await fetch(`/api/local-archive/orders?${sp.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { orders?: Order[] };
    return Array.isArray(data.orders) ? data.orders : [];
  } catch {
    return [];
  }
}

export async function exportLocalArchiveCsv(): Promise<{
  ok: boolean;
  csvPath?: string;
  rows?: number;
  error?: string;
}> {
  if (!canUseLocalArchive()) {
    return { ok: false, error: "Local archive only works on the shop PC POS." };
  }
  try {
    const res = await fetch("/api/local-archive/export", { method: "POST" });
    const data = (await res.json()) as {
      ok?: boolean;
      csvPath?: string;
      rows?: number;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || "Export failed" };
    }
    return {
      ok: true,
      csvPath: data.csvPath,
      rows: data.rows,
    };
  } catch {
    return { ok: false, error: "Export failed" };
  }
}

/** Test helper — drain the mirror queue immediately. */
export async function flushLocalArchiveForTests() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushArchiveQueue();
}
