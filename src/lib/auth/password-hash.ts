/**
 * SITE_PASSWORD_HASH is stored base64-encoded in the environment, not as the
 * raw bcrypt hash. Verified 2026-07-07: Next.js's env loader expands
 * `$identifier` sequences (identifier starting with a letter or underscore)
 * to that variable's value — empty string if undefined — even inside quoted
 * values in .env.local. A bcrypt hash (`$2b$12$<53-char salt+hash>`) survives
 * the `$2b$12$` prefix (digits can't start an identifier) but the salt/hash
 * body that follows starts with a letter often enough to get silently eaten.
 * Shell-style `$$` escaping does not reliably prevent this — outcome depends
 * on what follows each `$`. Base64 has no `$` at all, so expansion has
 * nothing to match, for every possible hash.
 */
export function encodeForEnv(bcryptHash: string): string {
  return Buffer.from(bcryptHash, "utf8").toString("base64");
}

export function decodePasswordHash(envValue: string): string {
  return Buffer.from(envValue, "base64").toString("utf8");
}
