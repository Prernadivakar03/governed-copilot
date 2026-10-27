import { useEffect, useState, type ReactNode } from "react";
import { api, refreshSession, type User } from "./api";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      if (await refreshSession()) {
        try {
          setUser(await api.me());
        } catch {
          /* not signed in */
        }
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
    try {
      await api.logout();
    } catch {
      /* clear locally anyway */
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}