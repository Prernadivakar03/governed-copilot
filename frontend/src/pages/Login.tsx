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
      <h1>Ledger</h1>
      <input placeholder="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
      <input placeholder="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <div className="error">{error}</div>}
      <button disabled={busy || !username || !password}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}