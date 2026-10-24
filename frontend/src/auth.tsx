import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, refreshSession, type User } from "./api";

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      if (await refreshSession()) {
        try { setUser(await api.me()); } catch { /* not signed in */ }
      }
      setLoading(false);
    })();
  }, []);

  const signIn = async (username: string, password: string) => {
    const u = await api.login(username, password);
    setUser(u);
    return u;
  };
  const signOut = async () => {
    try { await api.logout(); } catch { /* clear locally anyway */ }
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}