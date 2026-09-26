"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, type ReactNode } from "react";

/**
 * AuthGuard — membungkus halaman yang wajib login.
 * Status sesi diambil dari server (/api/auth/session); middleware juga
 * sudah memblokir /admin tanpa sesi valid, jadi ini lapisan kedua di sisi browser.
 */
export default function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.replace("/login?redirect=/admin");
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Memeriksa sesi pengelola…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
