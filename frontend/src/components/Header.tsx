import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sun, Moon, LogOut, User as UserIcon, Shield } from "lucide-react";
import { api, type SystemStatus, type User } from "../api";

interface HeaderProps {
  user: User;
  onSignOut: () => void;
}

const PAGE_TITLES: Record<string, { root: string; current: string }> = {
  "/overview": { root: "Analytics", current: "Overview Dashboard" },
  "/ask": { root: "Analytics", current: "AI Analytics Copilot" },
  "/catalog": { root: "Data Assets", current: "Data Catalog" },
  "/semantic": { root: "Modeling", current: "Semantic Layer" },
  "/studio": { root: "Exploration", current: "Query Studio" },
  "/history": { root: "Exploration", current: "Query History" },
  "/governance": { root: "Governance", current: "Governance Center" },
  "/approvals": { root: "Governance", current: "Approval Workflows" },
  "/audit": { root: "Compliance", current: "Audit Trail" },
  "/evals": { root: "Research", current: "Evaluation & Hallucination Audits" },
  "/metrics": { root: "Research", current: "Platform Metrics" },
  "/monitoring": { root: "Operations", current: "System Health & Diagnostics" },
  "/settings": { root: "Preferences", current: "Settings & Profile" },
};

export function Header({ user, onSignOut }: HeaderProps) {
  const location = useLocation();
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("theme") as "dark" | "light") || "dark";
  });
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    // Fetch initial system health status
    api.systemStatus()
      .then(setSystemStatus)
      .catch(() => {});
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  };

  const breadcrumb = PAGE_TITLES[location.pathname] || { root: "Copilot", current: "Workspace" };
  const isHealthy = systemStatus?.status === "operational";

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <div className="page-breadcrumb">
          <span className="breadcrumb-root">{breadcrumb.root}</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">{breadcrumb.current}</span>
        </div>
      </div>

      <div className="topbar-right">
        {systemStatus && (
          <div
            className="system-status-indicator"
            title={`PostgreSQL: ${systemStatus.database.status} (${systemStatus.database.ping_latency_ms}ms) | Ollama: ${systemStatus.llm.status}`}
          >
            <span className={`status-dot ${isHealthy ? "" : "degraded"}`} />
            <span>
              {isHealthy ? "System Ready" : "Degraded"}
              {systemStatus.database.ping_latency_ms > 0 && ` (${systemStatus.database.ping_latency_ms}ms)`}
            </span>
          </div>
        )}

        <button
          className="btn-ghost btn-icon"
          onClick={toggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="user-profile-badge" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "6px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              fontSize: "12px",
            }}
          >
            <UserIcon size={14} className="text-secondary" />
            <span style={{ fontWeight: 600 }}>{user.username}</span>
            <span className="badge badge-info" style={{ fontSize: "10px", padding: "1px 5px" }}>
              <Shield size={10} style={{ marginRight: "2px" }} />
              {user.role}
            </span>
          </div>

          <button
            className="btn-ghost btn-sm"
            onClick={onSignOut}
            title="Sign out of governed session"
            style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text-tertiary)" }}
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
