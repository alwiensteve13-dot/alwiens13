"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

/**
 * AuthGuard — wraps any page / layout that requires authentication.
 * Checks both Better Auth session and local session cookies for Vercel compatibility.
 */
export default function AuthGuard({ children }: { children: ReactNode }) {
  const { data: session, isPending: isLoading } = authClient.useSession();
  const [hasSessionCookie, setHasSessionCookie] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const cookies = typeof document !== "undefined" ? document.cookie : "";
    const hasSessionStore = typeof window !== "undefined" && (sessionStorage.getItem("neraca_air_session") === "active" || localStorage.getItem("neraca_air_session") === "active");
    
    // Require explicit active session cookie OR active session token
    const hasActiveCookie = cookies.includes("neraca_air_session=better-auth-active") || cookies.includes("better-auth.session_token");
    
    const isAuthenticated = hasActiveCookie && hasSessionStore;
    setHasSessionCookie(isAuthenticated);
  }, []);

  const isAuthenticated = !!session?.user || hasSessionCookie === true;

  useEffect(() => {
    if (!isLoading && hasSessionCookie !== null && !isAuthenticated) {
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }
    }
  }, [isLoading, hasSessionCookie, isAuthenticated, router]);

  /* Still determining auth state */
  if (hasSessionCookie === null || (isLoading && !hasSessionCookie)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Memeriksa sesi pengelola…</p>
        </div>
      </div>
    );
  }

  /* Not authenticated */
  if (!isAuthenticated) {
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
    return null;
  }

  return <>{children}</>;
}
