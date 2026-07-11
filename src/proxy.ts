import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionSecretError,
  shouldReissue,
  signSession,
  verifySession,
} from "@/lib/auth/session";

/**
 * The optional password gate. (Next 16 renamed Middleware to Proxy — same
 * job, Node runtime; flagged in CLAUDE.md.)
 *
 * - SITE_PASSWORD_HASH unset → the site is public and this is a pass-through.
 * - Hash set + SESSION_SECRET set (and long enough) → every route below
 *   except the gate itself requires a valid session cookie; pages redirect to
 *   /gate, APIs get 401.
 * - Hash set + SESSION_SECRET missing or too short → FAIL CLOSED with an
 *   explicit error. Never silently public, and never silently forgeable.
 *
 * Only the cookie check lives here; the bcrypt compare happens in
 * POST /api/auth (this is an optimistic check, per Next's own guidance).
 */

const GATE_EXEMPT = ["/gate", "/api/auth"];

function configError(message: string): NextResponse {
  return new NextResponse(`RAGfolio configuration error: ${message}`, {
    status: 500,
    headers: { "content-type": "text/plain" },
  });
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const passwordHash = process.env.SITE_PASSWORD_HASH;
  if (!passwordHash) return NextResponse.next(); // gate dormant — public site

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return configError(
      "SITE_PASSWORD_HASH is set but SESSION_SECRET is missing. The gate " +
        "fails closed rather than serving the site without it. Set " +
        "SESSION_SECRET (see .env.example)."
    );
  }
  const secretError = sessionSecretError(secret);
  if (secretError) return configError(secretError);

  const { pathname } = request.nextUrl;
  if (GATE_EXEMPT.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token, secret) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const gateUrl = new URL("/gate", request.url);
    if (pathname !== "/") gateUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(gateUrl);
  }

  // Sliding 7-day expiry: refresh the cookie once a day of age is reached.
  if (shouldReissue(session)) {
    const response = NextResponse.next();
    response.cookies.set(
      SESSION_COOKIE,
      await signSession(secret),
      sessionCookieOptions
    );
    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Gate everything except Next's static output and public files — the spec
  // exempts static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
