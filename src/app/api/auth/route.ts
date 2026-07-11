import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { decodePasswordHash } from "@/lib/auth/password-hash";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionSecretError,
  signSession,
} from "@/lib/auth/session";
import { checkRateLimit, requestIp } from "@/lib/ratelimit";

function configError(message: string): NextResponse {
  return NextResponse.json(
    { error: `RAGfolio configuration error: ${message}` },
    { status: 500 }
  );
}

/**
 * Password check for the optional gate: bcrypt compare against
 * SITE_PASSWORD_HASH, then a signed session cookie. Rate limited to slow
 * password guessing when Upstash is configured (~5 attempts/min/IP).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const passwordHash = process.env.SITE_PASSWORD_HASH;
  if (!passwordHash) {
    // Gate dormant — this endpoint has nothing to authenticate against.
    return NextResponse.json({ error: "gate not enabled" }, { status: 404 });
  }
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return configError(
      "SITE_PASSWORD_HASH is set but SESSION_SECRET is missing. The gate " +
        "fails closed — set SESSION_SECRET (see .env.example)."
    );
  }
  const secretError = sessionSecretError(secret);
  if (secretError) return configError(secretError);

  const limited = await checkRateLimit("auth", requestIp(request));
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many attempts — try again in a minute." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { password?: unknown }
    | null;
  if (!body || typeof body.password !== "string") {
    return NextResponse.json({ error: "password required" }, { status: 400 });
  }

  const valid = await bcrypt.compare(body.password, decodePasswordHash(passwordHash));
  if (!valid) {
    return NextResponse.json({ error: "incorrect password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    SESSION_COOKIE,
    await signSession(secret),
    sessionCookieOptions
  );
  return response;
}
