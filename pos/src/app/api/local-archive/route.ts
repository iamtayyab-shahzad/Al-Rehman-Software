import { NextRequest, NextResponse } from "next/server";
import { getArchiveStatus } from "@/lib/local-archive/db";
import {
  isLocalArchiveRequestAllowed,
  isLocalArchiveRuntimeEnabled,
} from "@/lib/local-archive/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isLocalArchiveRuntimeEnabled()) {
    return NextResponse.json({
      enabled: false,
      reason: "cloud_host",
    });
  }
  if (!isLocalArchiveRequestAllowed(req)) {
    return NextResponse.json(
      { enabled: false, reason: "forbidden_host" },
      { status: 403 },
    );
  }
  try {
    return NextResponse.json(getArchiveStatus());
  } catch (e) {
    return NextResponse.json(
      {
        enabled: false,
        reason: e instanceof Error ? e.message : "archive_error",
      },
      { status: 500 },
    );
  }
}
