/**
 * Generate SITE_PASSWORD_HASH.
 *
 *   npm run hash-password -- "your password here"
 *
 * Paste the printed line into .env.local (or a Vercel env var) as-is.
 * Cost factor 12 keeps a compare around ~100 ms — meaningful against
 * guessing, harmless for one login per visitor per week.
 *
 * The printed value is the bcrypt hash, base64-encoded — not the raw hash.
 * See src/lib/auth/password-hash.ts for why: Next's env loader expands `$`
 * sequences in .env values, which silently corrupts a raw bcrypt hash.
 */
import bcrypt from "bcryptjs";
import { encodeForEnv } from "../src/lib/auth/password-hash";

async function main(): Promise<void> {
  const password = process.argv.slice(2).join(" ");
  if (!password) {
    console.error('usage: npm run hash-password -- "your password"');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  console.log(`SITE_PASSWORD_HASH=${encodeForEnv(hash)}`);
}

main();
