import { useEffect, useState } from "react";
import {
  User as UserIcon,
  Sun,
  Moon,
  Shield,
  Key,
  Globe,
} from "lucide-react";
import { useAuth } from "../auth";

export default function Settings() {
  const { user, signOut } = useAuth();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current = (localStorage.getItem("theme") as "dark" | "light") || "dark";
    setTheme(current);
  }, []);

  const handleThemeChange = (newTheme: "dark" | "light") => {
    setTheme(newTheme);
    document.documentElement.dataset.theme = newTheme;
    localStorage.setItem("theme", newTheme);
  };

  const roleDescriptions: Record<string, string> = {
    analyst: "Business Analyst — Permitted to run governed natural language queries, inspect public & internal columns. PII columns are masked. Cannot decide approval requests.",
    steward: "Data Steward — Authorized to approve or reject gated analytical queries, view PII customer records for legitimate stewardship, and manage data lineage.",
    auditor: "Compliance Auditor — Read-only access to cryptographic hash chain, immutable audit event streams, and quantitative evaluation benchmark results.",
    admin: "System Administrator — Unrestricted access across all operational, diagnostic, and governance capabilities.",
  };

  return (
    <div className="workspace-page">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Platform Settings & Security Profile</h1>
          <p>User credentials, theme preferences, session configuration, and authorization grants</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "24px" }}>
        {/* User Identity Profile */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <UserIcon size={16} className="text-accent" />
              <span>Active User Profile</span>
            </div>
            <span className="badge badge-info">Authenticated</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "var(--accent-light)",
                  border: "1px solid var(--accent-border)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "var(--accent)",
                }}
              >
                {user?.username?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 600 }}>{user?.username}</div>
                <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>User ID: #{user?.id ?? "1"}</div>
              </div>
            </div>

            <div style={{ padding: "12px 14px", borderRadius: "8px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                <Shield size={14} className="text-accent" />
                <span>Assigned Role: {user?.role.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {roleDescriptions[user?.role ?? "analyst"]}
              </div>
            </div>

            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void signOut()} style={{ alignSelf: "flex-start" }}>
              Sign out from this session
            </button>
          </div>
        </div>

        {/* Interface Preferences */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Sun size={16} className="text-accent" />
              <span>Interface & Theme Appearance</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Select visual theme for the analytics workspace. High-contrast typography and subtle borders ensure WCAG AA compliance.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div
                onClick={() => handleThemeChange("dark")}
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  border: `2px solid ${theme === "dark" ? "var(--accent)" : "var(--border-subtle)"}`,
                  background: "#0d121f",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  color: "#f8fafc",
                }}
              >
                <Moon size={18} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "13px" }}>Dark Theme</div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>Deep slate & vibrant blue</div>
                </div>
              </div>

              <div
                onClick={() => handleThemeChange("light")}
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  border: `2px solid ${theme === "light" ? "var(--accent)" : "var(--border-subtle)"}`,
                  background: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  color: "#0f172a",
                }}
              >
                <Sun size={18} style={{ color: "#d97706" }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "13px" }}>Light Theme</div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>Clean neutral & white</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Token Parameters */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Key size={16} className="text-accent" />
              <span>Session Security & Cryptography</span>
            </div>
            <span className="badge badge-success">JWT HMAC-SHA256</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Access Token Lifespan:</span>
              <span className="mono">15 minutes (auto-rotating)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Refresh Token Storage:</span>
              <span className="mono">HttpOnly, SameSite=Lax Cookie</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Audit Ledger Hash:</span>
              <span className="mono">SHA-256 Merkle-Chained</span>
            </div>
          </div>
        </div>

        {/* Backend Endpoint Environment */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Globe size={16} className="text-accent" />
              <span>Backend API Gateway</span>
            </div>
            <span className="badge badge-neutral">Vite Proxy</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>API Gateway Endpoint:</span>
              <span className="mono">http://localhost:8000</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>OpenAPI Specification:</span>
              <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" style={{ fontSize: "12px" }}>
                Swagger Interactive Docs ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
