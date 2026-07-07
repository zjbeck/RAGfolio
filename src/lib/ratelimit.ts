import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting exists only when Upstash env vars are present. Absent, every
 * check succeeds — the README warns loudly that an unlimited public chat
 * endpoint spends your LLM quota for anyone who finds it.
 */

function configured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
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

export async function checkRateLimit(
  kind: LimiterKind,
  identifier: string
): Promise<{ success: boolean }> {
  if (!configured()) return { success: true };
  const { success } = await limiterFor(kind).limit(identifier);
  return { success };
}

/** Client IP for rate-limit identity; Vercel sets x-forwarded-for. */
export function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
