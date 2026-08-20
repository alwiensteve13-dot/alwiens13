import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware — lightweight server-side guard.
 *
 * For the frontend-first stub we check a simple cookie
 * (`neraca_air_session`). Later this will be replaced by a
 * Better Auth session token verification.
 *
 * Protected paths: /admin and any sub-routes.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("better-auth.session_token")?.value || request.cookies.get("neraca_air_session")?.value;

  /* Protect /admin routes */
  if (pathname.startsWith("/admin")) {
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  /* Protect API mutating routes (POST, PUT, DELETE) */
  if (pathname.startsWith("/api") && !pathname.startsWith("/api/auth")) {
    if (["POST", "PUT", "DELETE"].includes(request.method)) {
      if (!session) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
