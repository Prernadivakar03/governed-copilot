import { lazy, Suspense, useState, type ReactNode } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./authContext";
import type { Role } from "./api";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";

// Lazy-loaded Page Components for route-level code splitting
const Home = lazy(() => import("./pages/Home"));
const Loading = lazy(() => import("./pages/Loading"));
const Login = lazy(() => import("./pages/Login"));
const Overview = lazy(() => import("./pages/Overview"));
const Ask = lazy(() => import("./pages/Ask"));
const Catalog = lazy(() => import("./pages/Catalog"));
const Semantic = lazy(() => import("./pages/Semantic"));
const Studio = lazy(() => import("./pages/Studio"));
const History = lazy(() => import("./pages/History"));
const Governance = lazy(() => import("./pages/Governance"));
const Audit = lazy(() => import("./pages/Audit"));
const Evals = lazy(() => import("./pages/Evals"));
const Monitoring = lazy(() => import("./pages/Monitoring"));
const Settings = lazy(() => import("./pages/Settings"));

function RouteFallback() {
  return (
    <div style={{ padding: "48px 24px", display: "grid", placeItems: "center", minHeight: "40vh", color: "var(--text-tertiary)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "24px", height: "24px", border: "2px solid var(--border-subtle)", borderTopColor: "var(--accent-primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>LOADING MODULE...</span>
      </div>
    </div>
  );
}

function getHomeRoute(role: Role): string {
  if (role === "auditor") return "/overview";
  return "/overview";
}

function RoleGuard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ padding: "40px", display: "grid", placeItems: "center", color: "var(--text-tertiary)" }}>
        Loading authorized workspace...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={getHomeRoute(user.role)} replace />;
  return <>{children}</>;
}

function AppShell() {
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      <Sidebar
        role={user.role}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
      />
      <div className="app-main">
        <Header user={user} onSignOut={() => void signOut()} />
        <main style={{ flex: 1 }}>
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public Home Landing Page */}
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />

        {/* System Initialization & Loader */}
        <Route path="/loading" element={<Loading />} />

        {/* Authentication */}
        <Route path="/login" element={<Login />} />

      <Route element={<AppShell />}>
        {/* 1. Overview Dashboard */}
        <Route
          path="/overview"
          element={
            <RoleGuard roles={["analyst", "steward", "auditor", "admin"]}>
              <Overview />
            </RoleGuard>
          }
        />

        {/* 2. AI Analytics Copilot */}
        <Route
          path="/ask"
          element={
            <RoleGuard roles={["analyst", "steward", "admin"]}>
              <Ask />
            </RoleGuard>
          }
        />

        {/* 3. Data Catalog */}
        <Route
          path="/catalog"
          element={
            <RoleGuard roles={["analyst", "steward", "auditor", "admin"]}>
              <Catalog />
            </RoleGuard>
          }
        />

        {/* 4. Semantic Layer */}
        <Route
          path="/semantic"
          element={
            <RoleGuard roles={["analyst", "steward", "auditor", "admin"]}>
              <Semantic />
            </RoleGuard>
          }
        />

        {/* 5. Query Studio */}
        <Route
          path="/studio"
          element={
            <RoleGuard roles={["analyst", "steward", "admin"]}>
              <Studio />
            </RoleGuard>
          }
        />

        {/* 6. Query History */}
        <Route
          path="/history"
          element={
            <RoleGuard roles={["analyst", "steward", "admin"]}>
              <History />
            </RoleGuard>
          }
        />

        {/* 7. Governance Center & Approvals */}
        <Route
          path="/governance"
          element={
            <RoleGuard roles={["steward", "auditor", "admin"]}>
              <Governance />
            </RoleGuard>
          }
        />
        <Route
          path="/approvals"
          element={
            <RoleGuard roles={["steward", "admin"]}>
              <Governance />
            </RoleGuard>
          }
        />

        {/* 8. Audit Logs */}
        <Route
          path="/audit"
          element={
            <RoleGuard roles={["auditor", "admin"]}>
              <Audit />
            </RoleGuard>
          }
        />

        {/* 9. Evaluation & Hallucination Audits */}
        <Route
          path="/evals"
          element={
            <RoleGuard roles={["auditor", "admin"]}>
              <Evals />
            </RoleGuard>
          }
        />
        <Route
          path="/metrics"
          element={
            <RoleGuard roles={["auditor", "admin"]}>
              <Evals />
            </RoleGuard>
          }
        />

        {/* 10. System Monitoring */}
        <Route
          path="/monitoring"
          element={
            <RoleGuard roles={["analyst", "steward", "auditor", "admin"]}>
              <Monitoring />
            </RoleGuard>
          }
        />

        {/* 11. Settings & Profile */}
        <Route
          path="/settings"
          element={
            <RoleGuard roles={["analyst", "steward", "auditor", "admin"]}>
              <Settings />
            </RoleGuard>
          }
        />

        {/* Default Catch-all */}
        <Route
          path="*"
          element={loading ? null : <Navigate to={user ? getHomeRoute(user.role) : "/"} replace />}
        />
      </Route>
    </Routes>
    </Suspense>
  );
}
