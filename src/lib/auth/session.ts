import { jwtVerify, SignJWT } from "jose";

/**
 * Session cookies for the optional password gate. The proxy verifies and
 * re-issues; /api/auth signs after a successful bcrypt compare. jose keeps
 * this portable across runtimes.
 */

export const SESSION_COOKIE = "ragfolio_session";

/** 7-day sliding expiry: re-issued whenever the token is older than a day. */
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const REISSUE_AFTER_SECONDS = 24 * 60 * 60;

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSession(secret: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
    .sign(key(secret));
}

export interface SessionInfo {
  issuedAt: number; // epoch seconds
}

/** Returns session info for a valid token, null for anything else. */
export async function verifySession(
  token: string,
  secret: string
): Promise<SessionInfo | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret));
    return { issuedAt: payload.iat ?? 0 };
  } catch {
    return null;
  }
}

export function shouldReissue(session: SessionInfo): boolean {
  return Date.now() / 1000 - session.issuedAt > REISSUE_AFTER_SECONDS;
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
