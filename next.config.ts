import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/**
 * Custom-theme detection at build time. The vanilla/custom palette toggle is
 * enabled only when src/styles/theme.custom.css exists; otherwise it renders
 * disabled. Exposed to the client as NEXT_PUBLIC_HAS_CUSTOM_THEME.
 *
 * Anchored to this config file's own directory (the project root), not
 * process.cwd(), which is not the project root under every launcher.
 */
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const hasCustomTheme = fs.existsSync(
  path.join(rootDir, "src/styles/theme.custom.css")
);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_HAS_CUSTOM_THEME: String(hasCustomTheme),
  },
};

export default nextConfig;
