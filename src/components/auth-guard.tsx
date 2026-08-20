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
    const activeCookie = cookies.includes("neraca_air_session") || cookies.includes("better-auth.session_token");
    setHasSessionCookie(activeCookie);
  }, []);

  const isAuthenticated = !!session?.user || hasSessionCookie === true;

  useEffect(() => {
    if (!isLoading && hasSessionCookie !== null && !isAuthenticated) {
      router.replace("/login");
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
    return null;
  }

  return <>{children}</>;
}
