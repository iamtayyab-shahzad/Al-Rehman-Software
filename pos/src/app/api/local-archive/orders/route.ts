import { NextRequest, NextResponse } from "next/server";
import {
  queryArchiveOrders,
  upsertArchiveOrders,
} from "@/lib/local-archive/db";
import { isLocalArchiveRequestAllowed } from "@/lib/local-archive/guard";
import type { Order } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isLocalArchiveRequestAllowed(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const sp = req.nextUrl.searchParams;
  try {
    const orders = queryArchiveOrders({
      q: sp.get("q") || undefined,
      status: sp.get("status") || undefined,
      from: sp.get("from") || undefined,
      to: sp.get("to") || undefined,
      limit: Number(sp.get("limit") || 500),
      offset: Number(sp.get("offset") || 0),
    });
    return NextResponse.json({ orders });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "query_failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isLocalArchiveRequestAllowed(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const body = (await req.json()) as { orders?: Order[] };
    const orders = Array.isArray(body.orders) ? body.orders : [];
    const result = upsertArchiveOrders(orders);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "upsert_failed" },
      { status: 500 },
    );
  }
}
