"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

/**
 * AuthGuard — wraps any page / layout that requires authentication.
 * Uses sessionStorage (dies on tab close) as the ONLY client-side session check.
 * This ensures users MUST log in every time they open a new browser/tab.
 */
export default function AuthGuard({ children }: { children: ReactNode }) {
  const { data: session, isPending: isLoading } = authClient.useSession();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    // Clear any legacy localStorage session to prevent bypass
    try { localStorage.removeItem("neraca_air_session"); } catch (e) {}

    // Check sessionStorage OR session cookie — ensures auth works reliably across tab/redirects
    const hasSessionStorage = typeof window !== "undefined" 
      && sessionStorage.getItem("neraca_air_session") === "active";
    const hasSessionCookie = typeof document !== "undefined"
      && document.cookie.includes("neraca_air_session=active");
    
    setIsAuthed(hasSessionStorage || hasSessionCookie);
    setAuthChecked(true);
  }, []);

  // Also accept Better Auth server session if available
  const isAuthenticated = !!session?.user || isAuthed;

  useEffect(() => {
    if (authChecked && !isLoading && !isAuthenticated) {
      window.location.replace("/login?redirect=/admin");
    }
  }, [authChecked, isLoading, isAuthenticated]);

  // Still checking auth state
  if (!authChecked || (isLoading && !isAuthed)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Memeriksa sesi pengelola…</p>
        </div>
      </div>
    );
  }

  // Not authenticated → redirect
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
