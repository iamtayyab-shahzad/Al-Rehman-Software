import { NextRequest } from "next/server";

/** Archive is for the shop PC local Next server only — never cloud/Vercel. */
export function isLocalArchiveRuntimeEnabled() {
  if (process.env.VERCEL) return false;
  if (process.env.ALREHMAN_DISABLE_LOCAL_ARCHIVE === "1") return false;
  return true;
}

export function isLocalArchiveRequestAllowed(req: NextRequest) {
  if (!isLocalArchiveRuntimeEnabled()) return false;
  const host = req.headers.get("host") || "";
  const hostname = host.split(":")[0]?.toLowerCase() || "";
  if (hostname === "127.0.0.1" || hostname === "localhost") return true;
  // Direct IP of the till on LAN is still OK for same-machine tools.
  if (hostname === "::1") return true;
  return false;
}
