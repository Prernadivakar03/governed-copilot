import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { errorMessage } from "../api";
import { home } from "../App";
import { useAuth } from "../auth";

export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={home(user.role)} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const u = await signIn(username.trim(), password);
      navigate(home(u.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card login stack" onSubmit={(e) => void submit(e)}>
      <div className="login-brand"><img src="/governed-mark.svg" alt="" /><div><h1>Governed Copilot</h1><p className="muted">Sign in to your workspace</p></div></div>
      <label htmlFor="username">Username</label><input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
      <label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <div className="error">{error}</div>}
      <button disabled={busy || !username || !password}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
