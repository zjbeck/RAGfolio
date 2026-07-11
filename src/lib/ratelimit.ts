import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting is fully engaged only when BOTH Upstash env vars are present;
 * with neither set, chat has no limiting — the README warns loudly that an
 * unlimited public chat endpoint spends your LLM quota for anyone who finds
 * it. Auth gets an in-memory fallback either way (see fallbackAuthLimit)
 * since bcrypt is real CPU work an unauthenticated flood can exploit, and
 * "unconfigured" should never quietly mean "unprotected" for that endpoint.
 *
 * Exactly ONE var set is treated as a misconfiguration, not "disabled" — see
 * the throw below. A silent partial-config fallback to unprotected would be
 * worse than an explicit failure: the operator believes limiting is on.
 */
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (Boolean(UPSTASH_URL) !== Boolean(UPSTASH_TOKEN)) {
  throw new Error(
    "RAGfolio configuration error: exactly one of UPSTASH_REDIS_REST_URL / " +
      "UPSTASH_REDIS_REST_TOKEN is set. Both are required to enable rate " +
      "limiting, or neither to leave it disabled (with auth still covered " +
      "by its in-memory fallback) — a partial configuration would otherwise " +
      "silently disable limiting while looking configured. Set both (see " +
      ".env.example) or remove the one that's present."
  );
}

function configured(): boolean {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

type LimiterKind = "chat" | "auth";

const limiters = new Map<LimiterKind, Ratelimit>();

function limiterFor(kind: LimiterKind): Ratelimit {
  let limiter = limiters.get(kind);
  if (!limiter) {
    const redis = Redis.fromEnv();
    limiter = new Ratelimit({
      redis,
      prefix: `ragfolio:${kind}`,
      limiter:
        kind === "auth"
          ? Ratelimit.slidingWindow(5, "60 s") // password guessing
          : Ratelimit.slidingWindow(10, "60 s"), // LLM quota protection
    });
    limiters.set(kind, limiter);
  }
  return limiter;
}

/**
 * Fallback limiter for /api/auth when Upstash isn't configured. Bcrypt (cost
 * 12, ~100ms) is real synchronous CPU work — without this, an unauthenticated
 * flood of /api/auth POSTs is a local CPU-DoS vector regardless of whether
 * the password is ever guessed. Deliberately weaker than Upstash: in-memory,
 * so it's per-instance (not shared across a multi-instance deployment) and
 * resets on cold start. That's an accepted trade-off, not a full substitute —
 * Upstash is still the real protection for a production deployment; this
 * exists so "unconfigured" fails safe instead of wide open. Same threshold as
 * the configured case (5/min) for consistent behavior either way.
 */
const FALLBACK_AUTH_WINDOW_MS = 60_000;
const FALLBACK_AUTH_MAX = 5;
const fallbackAuthHits = new Map<string, number[]>();

function fallbackAuthLimit(identifier: string): { success: boolean } {
  const now = Date.now();
  const windowStart = now - FALLBACK_AUTH_WINDOW_MS;
  const hits = (fallbackAuthHits.get(identifier) ?? []).filter((t) => t > windowStart);
  hits.push(now);
  fallbackAuthHits.set(identifier, hits);
  // Bound the map's growth across many distinct IPs — this is a best-effort
  // fallback, not a precise distributed limiter.
  if (fallbackAuthHits.size > 10_000) fallbackAuthHits.clear();
  return { success: hits.length <= FALLBACK_AUTH_MAX };
}

export async function checkRateLimit(
  kind: LimiterKind,
  identifier: string
): Promise<{ success: boolean }> {
  if (!configured()) {
    if (kind === "auth") return fallbackAuthLimit(identifier);
    return { success: true };
  }
  const { success } = await limiterFor(kind).limit(identifier);
  return { success };
}

/** Client IP for rate-limit identity; Vercel sets x-forwarded-for. */
export function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
