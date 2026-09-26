import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Middleware — penjaga di sisi server.
 *
 * - /admin/*                      → wajib sesi pengelola yang valid (token bertanda tangan)
 * - /api/* dengan POST/PUT/PATCH/DELETE → wajib sesi valid, kecuali login/logout
 *
 * Token diverifikasi dengan HMAC (AUTH_SECRET), jadi cookie yang dibuat sendiri
 * oleh pengunjung tidak akan diterima.
 */
const PUBLIC_API_MUTATIONS = new Set(["/api/auth/login", "/api/auth/logout"]);
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/admin") && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    pathname.startsWith("/api") &&
    MUTATING_METHODS.has(request.method) &&
    !PUBLIC_API_MUTATIONS.has(pathname) &&
    !session
  ) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
