import { NextRequest, NextResponse } from "next/server";
import { exportArchiveCsv } from "@/lib/local-archive/db";
import { isLocalArchiveRequestAllowed } from "@/lib/local-archive/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isLocalArchiveRequestAllowed(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const result = exportArchiveCsv();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "export_failed" },
      { status: 500 },
    );
  }
}
