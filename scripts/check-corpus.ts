/**
 * predev guard: src/generated/corpus.json is statically imported by
 * src/lib/corpus/retrieval.ts (bundler-resolved, not read at runtime — see
 * CLAUDE.md), so a missing artifact fails as an opaque "module not found"
 * from Turbopack instead of a clear message. Catch it here instead.
 */
import fs from "node:fs";
import path from "node:path";

const artifactPath = path.resolve(process.cwd(), "src/generated/corpus.json");

if (!fs.existsSync(artifactPath)) {
  console.error(
    "\n✗ src/generated/corpus.json is missing.\n\n" +
      "  It's a build-time artifact (gitignored) — run this first:\n\n" +
      "    npm run ingest\n"
  );
  process.exit(1);
}
