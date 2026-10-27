import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Shield, Lock, User as UserIcon, ArrowRight, AlertCircle } from "lucide-react";
import { errorMessage } from "../api";
import { useAuth } from "../auth";

export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/overview" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!username || !password || busy) return;
    setBusy(true);
    setError("");
    try {
      await signIn(username.trim(), password);
      navigate("/overview", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const fillCredentials = (u: string, p: string = "DemoPass12345") => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: "var(--bg-app)",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "440px",
          padding: "32px",
          boxShadow: "var(--shadow-lg)",
          background: "var(--bg-panel)",
          border: "1px solid var(--border-medium)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, var(--accent), #1d4ed8)",
              display: "grid",
              placeItems: "center",
              color: "white",
              boxShadow: "0 2px 10px var(--accent-border)",
            }}
          >
            <Shield size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: "20px", margin: 0 }}>Governed Analytics</h1>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "2px 0 0" }}>
              MDS-25 Research-Grade Copilot Platform
            </p>
          </div>
        </div>

        <form onSubmit={(e) => void submit(e)} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="username" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <UserIcon size={13} />
              <span>Username</span>
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. alice, sam, audrey, adam"
              required
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="password" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Lock size={13} />
              <span>Password</span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
          </div>

          {error && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger-border)",
                color: "var(--danger)",
                fontSize: "12.5px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "6px" }}
            disabled={busy || !username || !password}
          >
            <span>{busy ? "Authenticating Session..." : "Sign In to Workspace"}</span>
            <ArrowRight size={14} />
          </button>
        </form>

        {/* Quick-Fill Demo Profiles for Examiners */}
        <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
            Quick-Login Role Profiles
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => fillCredentials("alice")}
              style={{ justifyContent: "flex-start", padding: "6px 8px" }}
            >
              <span className="badge badge-success" style={{ fontSize: "9px" }}>Analyst</span>
              <span style={{ fontSize: "12px" }}>alice</span>
            </button>

            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => fillCredentials("sam")}
              style={{ justifyContent: "flex-start", padding: "6px 8px" }}
            >
              <span className="badge badge-warning" style={{ fontSize: "9px" }}>Steward</span>
              <span style={{ fontSize: "12px" }}>sam</span>
            </button>

            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => fillCredentials("audrey")}
              style={{ justifyContent: "flex-start", padding: "6px 8px" }}
            >
              <span className="badge badge-info" style={{ fontSize: "9px" }}>Auditor</span>
              <span style={{ fontSize: "12px" }}>audrey</span>
            </button>

            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => fillCredentials("adam")}
              style={{ justifyContent: "flex-start", padding: "6px 8px" }}
            >
              <span className="badge badge-neutral" style={{ fontSize: "9px" }}>Admin</span>
              <span style={{ fontSize: "12px" }}>adam</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
