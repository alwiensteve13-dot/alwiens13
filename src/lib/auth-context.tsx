"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface AdminUser {
  email: string;
  name: string;
}

interface LoginResult {
  ok: boolean;
  error?: string;
}

interface AuthContextValue {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

function toUser(email: string): AdminUser {
  return { email, name: email.split("@")[0] || "Admin" };
}

/* ------------------------------------------------------------------ */
/*  Context — sesi disimpan di cookie httpOnly oleh server,           */
/*  browser hanya menanyakan status lewat /api/auth/session.          */
/* ------------------------------------------------------------------ */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const data = await res.json();
      setUser(data?.authenticated && data.user?.email ? toUser(data.user.email) : null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Bersihkan sisa penanda sesi lama yang dulu bisa dipalsukan dari browser.
    try {
      localStorage.removeItem("neraca_air_session");
      sessionStorage.removeItem("neraca_air_session");
      document.cookie = "neraca_air_session=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    } catch {
      /* abaikan */
    }
    // Sinkronisasi awal status sesi dari server (setState terjadi setelah fetch selesai).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return { ok: false, error: data?.error || "Gagal masuk. Coba lagi." };
      }
      setUser(toUser(data.user.email));
      return { ok: true };
    } catch {
      return { ok: false, error: "Tidak dapat terhubung ke server." };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* tetap lanjut keluar */
    }
    setUser(null);
    window.location.replace("/login");
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
