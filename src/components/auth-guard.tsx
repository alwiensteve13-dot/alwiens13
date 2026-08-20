"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

/**
 * AuthGuard — wraps any page / layout that requires authentication.
 * When the user is not authenticated it redirects to /login.
 * While checking auth state it renders a centered spinner.
 */
export default function AuthGuard({ children }: { children: ReactNode }) {
  const { data: session, isPending: isLoading } = authClient.useSession();
  const isAuthenticated = !!session?.user;
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  /* Still determining auth state */
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Memeriksa sesi…</p>
        </div>
      </div>
    );
  }

  /* Not authenticated — will redirect in the effect above */
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
