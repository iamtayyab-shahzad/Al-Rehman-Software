import fs from "fs";
import os from "os";
import path from "path";
import { shop } from "@/lib/shop";

/** Root folder for durable POS files on this Windows/macOS/Linux PC. */
export function getLocalDataRoot(overrideRoot?: string): string {
  if (overrideRoot) return overrideRoot;
  const folder = shop.posDbName || "alrehman-pos";
  if (process.env.ALREHMAN_POS_DATA) {
    return process.env.ALREHMAN_POS_DATA;
  }
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    return path.join(localAppData, folder);
  }
  return path.join(os.homedir(), `.${folder}`);
}

export function getArchiveDir(overrideRoot?: string): string {
  return path.join(getLocalDataRoot(overrideRoot), "archive");
}

/** Durable order archive — plain JSON file, no native compiler required. */
export function getArchiveDbPath(overrideRoot?: string): string {
  return path.join(getArchiveDir(overrideRoot), "orders.archive.json");
}

export function ensureArchiveDir(overrideRoot?: string): string {
  const dir = getArchiveDir(overrideRoot);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
