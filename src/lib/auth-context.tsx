"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface AdminUser {
  id: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

/* ------------------------------------------------------------------ */
/*  Stub credentials (frontend-first — will be replaced by backend)    */
/* ------------------------------------------------------------------ */
const STUB_ADMIN: AdminUser = {
  id: "admin-001",
  email: "admin@neracaair.id",
  name: "Admin Maluku",
};
const STUB_PASSWORD = "admin123";

/* ------------------------------------------------------------------ */
/*  Cookie helpers — sync session with middleware                       */
/* ------------------------------------------------------------------ */
const SESSION_KEY = "neraca_air_session";

function setCookie(name: string, value: string, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  /* Restore session from localStorage on mount */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AdminUser;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUser(parsed);
        /* Ensure cookie stays in sync */
        setCookie(SESSION_KEY, stored);
      }
    } catch {
      /* corrupted data — ignore */
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      /* Simulate network delay */
      await new Promise((r) => setTimeout(r, 800));

      if (email === STUB_ADMIN.email && password === STUB_PASSWORD) {
        const json = JSON.stringify(STUB_ADMIN);
        setUser(STUB_ADMIN);
        localStorage.setItem(SESSION_KEY, json);
        setCookie(SESSION_KEY, json);
        return true;
      }
      return false;
    },
    [],
  );

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
    deleteCookie(SESSION_KEY);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
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
