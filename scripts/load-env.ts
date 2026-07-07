import fs from "node:fs";
import path from "node:path";

/**
 * Load .env.local for standalone scripts (ingest, ask, eval). Next.js loads
 * it automatically for the app; scripts run outside Next and need this.
 * Uses Node's built-in loader — existing environment variables win.
 */
export function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}
