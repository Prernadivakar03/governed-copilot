import { useEffect, type ReactNode } from "react";
import { Navigate, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import type { Role } from "./api";
import Approvals from "./pages/Approvals";
import Ask from "./pages/Ask";
import Audit from "./pages/Audit";
import Login from "./pages/Login";
import Metrics from "./pages/Metrics";

export const home = (role: Role) => (role === "auditor" ? "/audit" : "/ask");

function Guard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted page">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={home(user.role)} replace />;
  return <>{children}</>;
}

function Shell() {
  const { user, signOut } = useAuth();
  const toggleTheme = () => {
    const root = document.documentElement;
    const theme = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  };
  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem("theme") === "light" ? "light" : "dark";
  }, []);
  return (
    <>
      <header className="top">
        <span className="brand"><img src="/governed-mark.svg" alt="" />Governed Copilot</span>
        {user && (
          <nav>
            {user.role !== "auditor" && <NavLink to="/ask">Ask</NavLink>}
            {(user.role === "steward" || user.role === "admin") && <NavLink to="/approvals">Approvals</NavLink>}
            {(user.role === "auditor" || user.role === "admin") && <NavLink to="/audit">Audit</NavLink>}
            {(user.role === "auditor" || user.role === "admin") && <NavLink to="/metrics">Metrics</NavLink>}
          </nav>
        )}
        <span className="spacer" />
        <button className="ghost" onClick={toggleTheme}>Theme</button>
        {user && (
          <>
            <span className="muted mono">{user.username} · {user.role}</span>
            <button className="ghost" onClick={() => void signOut()}>Sign out</button>
          </>
        )}
      </header>
      <main className="page"><Outlet /></main>
    </>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Shell />}>
        <Route path="/ask" element={<Guard roles={["analyst", "steward", "admin"]}><Ask /></Guard>} />
        <Route path="/approvals" element={<Guard roles={["steward", "admin"]}><Approvals /></Guard>} />
        <Route path="/audit" element={<Guard roles={["auditor", "admin"]}><Audit /></Guard>} />
        <Route path="/metrics" element={<Guard roles={["auditor", "admin"]}><Metrics /></Guard>} />
        <Route path="*" element={loading ? null : <Navigate to={user ? home(user.role) : "/login"} replace />} />
      </Route>
    </Routes>
  );
}
